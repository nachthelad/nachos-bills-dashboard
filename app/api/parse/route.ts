import { type NextRequest, NextResponse } from "next/server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CategoryValue } from "@/config/billing/categories";
import {
  PROVIDER_HINT_KEYWORD_MAP,
  type ProviderHint,
} from "@/config/billing/providerHints";
import { normalizeCategory, normalizeSearchValue } from "@/lib/category-utils";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import {
  calculateHoaTotals,
  isNormalizedHoaDetails,
  normalizeHoaDetails,
  normalizeHoaSummaryPayload,
} from "@/lib/server/hoa";
import { createRequestLogger } from "@/lib/server/logger";
import type { Logger } from "@/lib/server/logger";

import { upsertHoaSummary } from "@/lib/server/hoa-service";
import {
  extractPdfText,
  parseBillingImageWithOpenAI,
  parseBillingTextWithOpenAI,
  type BillingParseResult,
} from "./parser";
import { parseWithRules } from "./rules-parser";
import { Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { performance } from "node:perf_hooks";

export async function POST(request: NextRequest) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "POST /api/parse" },
  });
  let log = baseLogger;
  try {
    const { uid } = await authenticateRequest(request);
    log = log.withContext({ userId: uid });
    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId" },
        { status: 400 }
      );
    }

    const docRef = getAdminFirestore().collection("documents").doc(documentId);
    const docSnapshot = await docRef.get();
    if (!docSnapshot.exists) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const documentData = docSnapshot.data();
    if (documentData?.userId && documentData.userId !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const pdfUrl = documentData?.pdfUrl ?? documentData?.storageUrl;

    if (!pdfUrl) {
      return NextResponse.json(
        { error: "Document has no pdfUrl/storageUrl" },
        { status: 400 }
      );
    }

    // Detect image files by URL/filename extension — images go straight to vision AI
    const imageMimeType = getImageMimeType(
      pdfUrl,
      documentData?.fileName ?? null
    );

    // Only use cached text for PDFs; images are always re-sent to vision AI
    const cachedText = !imageMimeType
      ? getNonEmptyString(documentData?.textExtract)
      : null;
    let fullText: string | null = cachedText;

    if (cachedText) {
      log.debug("PDF download skipped", {
        durationMs: 0,
        reason: "cached_text",
      });
    }

    let fileBuffer: Buffer | null = null;
    if (!fullText) {
      const downloadStart = performance.now();
      try {
        const fileResponse = await fetch(pdfUrl);
        if (!fileResponse.ok) {
          const errorBody = await fileResponse.text();
          throw new Error(
            `Failed to download file: ${fileResponse.status} ${errorBody}`
          );
        }
        const arrayBuffer = await fileResponse.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } catch (error: any) {
        const downloadDuration = performance.now() - downloadStart;
        log.error("PDF download error", {
          error,
          documentId,
          pdfUrl,
          durationMs: Number(downloadDuration.toFixed(2)),
        });
        await updateDocumentWithMetrics(
          docRef,
          {
            status: "needs_review",
            errorMessage: error.message ?? "Failed to download PDF",
            updatedAt: new Date(),
          },
          log,
          "pdf_download_error"
        );
        return NextResponse.json(
          { error: "Failed to download PDF" },
          { status: 502 }
        );
      }
      const downloadDuration = performance.now() - downloadStart;
      log.debug("PDF download completed", {
        durationMs: Number(downloadDuration.toFixed(2)),
      });

      if (!imageMimeType) {
        const textExtractionStart = performance.now();
        try {
          fullText = await extractPdfText(fileBuffer, log);
        } catch (error: any) {
          const extractionDuration = performance.now() - textExtractionStart;
          log.error("Text extraction error", {
            error,
            documentId,
            durationMs: Number(extractionDuration.toFixed(2)),
          });
          await updateDocumentWithMetrics(
            docRef,
            {
              status: "needs_review",
              errorMessage: error.message ?? "Failed to extract PDF text",
              updatedAt: new Date(),
            },
            log,
            "text_extraction_error"
          );
          return NextResponse.json(
            { error: "Failed to extract PDF text" },
            { status: 502 }
          );
        }
        const extractionDuration = performance.now() - textExtractionStart;
        log.debug("Text extraction completed", {
          durationMs: Number(extractionDuration.toFixed(2)),
          source: "pdf",
        });
      }
    } else {
      log.debug("Text extraction completed", {
        durationMs: 0,
        source: "cache",
      });
    }

    if (!imageMimeType && (!fullText || !fullText.trim())) {
      const errorMessage = "Extracted text was empty";
      await updateDocumentWithMetrics(
        docRef,
        {
          status: "needs_review",
          errorMessage,
          textExtract: fullText ?? null,
          updatedAt: new Date(),
        },
        log,
        "empty_text_extract"
      );
      return NextResponse.json({ error: errorMessage }, { status: 502 });
    }

    // Detect provider early to decide which parser to use (PDF path only)
    const earlyProvider = !imageMimeType
      ? inferProviderFromContent({
          fileName: documentData?.fileName,
          text: fullText,
        })
      : null;
    const useRulesParser =
      earlyProvider !== null &&
      earlyProvider.category !== "credit_card" &&
      earlyProvider.category !== "hoa";

    let parseResponse: BillingParseResult;
    const parserStart = performance.now();
    const parserType = imageMimeType
      ? "openai_vision"
      : useRulesParser
        ? "rules"
        : "openai";
    try {
      if (imageMimeType && fileBuffer) {
        parseResponse = await parseBillingImageWithOpenAI(
          fileBuffer,
          imageMimeType,
          log
        );
        fullText = parseResponse.text ?? "[image]";
        log.debug("Vision-based parsing completed", {
          mimeType: imageMimeType,
          hasAmount: parseResponse.totalAmount !== null,
          hasDueDate: parseResponse.dueDate !== null,
        });
      } else if (useRulesParser && earlyProvider) {
        parseResponse = parseWithRules(fullText!, earlyProvider);
        log.debug("Rules-based parsing completed", {
          category: earlyProvider.category,
          providerId: earlyProvider.providerId,
          hasAmount: parseResponse.totalAmount !== null,
          hasDueDate: parseResponse.dueDate !== null,
        });
      } else {
        parseResponse = await parseBillingTextWithOpenAI(fullText!, log);
      }
    } catch (error: any) {
      const parserDuration = performance.now() - parserStart;
      log.error("PDF parsing error", {
        error,
        documentId,
        durationMs: Number(parserDuration.toFixed(2)),
      });
      await updateDocumentWithMetrics(
        docRef,
        {
          status: "needs_review",
          errorMessage: error.message ?? "Failed to parse PDF",
          textExtract: fullText,
          updatedAt: new Date(),
        },
        log,
        "parse_error_update"
      );
      return NextResponse.json(
        { error: "Failed to parse PDF" },
        { status: 502 }
      );
    } finally {
      const parserDuration = performance.now() - parserStart;
      log.debug("Parser latency captured", {
        durationMs: Number(parserDuration.toFixed(2)),
        parser: parserType,
      });
    }

    const detectedCategory = normalizeCategory(
      parseResponse.providerId ?? documentData?.providerId,
      parseResponse.category ?? documentData?.category,
      parseResponse.providerNameDetected ??
        documentData?.provider ??
        documentData?.providerNameDetected ??
        null
    );

    const normalizedHoaDetails = normalizeHoaDetails(parseResponse.hoaDetails);

    const updatePayload: Record<string, any> = {
      textExtract:
        fullText ?? parseResponse.text ?? documentData?.textExtract ?? null,
      providerId: parseResponse.providerId ?? documentData?.providerId ?? null,
      providerNameDetected:
        parseResponse.providerNameDetected ??
        documentData?.providerNameDetected ??
        null,
      provider:
        parseResponse.providerNameDetected ??
        parseResponse.providerId ??
        documentData?.provider ??
        documentData?.providerNameDetected ??
        null,
      category: detectedCategory,
      totalAmount:
        parseResponse.totalAmount ?? documentData?.totalAmount ?? null,
      amount: parseResponse.totalAmount ?? documentData?.amount ?? null,
      currency: parseResponse.currency ?? documentData?.currency ?? null,
      foreignAmountUSD: parseResponse.foreignAmountUSD ?? null,
      status: parseResponse.text ? "parsed" : "needs_review",
      lastParsedAt: new Date(),
      errorMessage: null,
    };

    if (normalizedHoaDetails) {
      updatePayload.hoaDetails = normalizedHoaDetails;
    } else if ("hoaDetails" in parseResponse) {
      updatePayload.hoaDetails = parseResponse.hoaDetails ?? null;
    }

    if (normalizedHoaDetails?.totalToPayUnit != null) {
      updatePayload.totalAmount = normalizedHoaDetails.totalToPayUnit;
      updatePayload.amount = normalizedHoaDetails.totalToPayUnit;
      updatePayload.currency = parseResponse.currency ?? "ARS";
      updatePayload.category = "hoa";
      if (!updatePayload.providerId) {
        updatePayload.providerId = "expensas_genericas";
      }
      if (!updatePayload.provider) {
        updatePayload.provider =
          parseResponse.providerNameDetected ?? "Expensas consorcio";
      }
    }

    const providerInferenceCache = new Map<string, ProviderHint | null>();
    const inferenceStart = performance.now();
    const fallbackProvider = inferProviderFromContent(
      {
        fileName: documentData?.fileName,
        text:
          updatePayload.textExtract ??
          documentData?.textExtract ??
          parseResponse.text ??
          "",
      },
      providerInferenceCache
    );
    const inferenceDuration = performance.now() - inferenceStart;
    log.debug("Provider inference latency captured", {
      durationMs: Number(inferenceDuration.toFixed(2)),
    });

    if (fallbackProvider) {
      const currentCategory = updatePayload.category;
      const shouldApplyFallback =
        currentCategory === "other" ||
        !currentCategory ||
        fallbackProvider.category === currentCategory;

      if (shouldApplyFallback) {
        updatePayload.providerId ??= fallbackProvider.providerId;
        updatePayload.provider ??= fallbackProvider.providerName;
        updatePayload.category =
          fallbackProvider.category ?? updatePayload.category;
      }
    }

    const assignDate = (field: string, value?: string | null) => {
      if (!value) return;
      const parsed = parseDate(value);
      if (parsed) {
        updatePayload[field] = Timestamp.fromDate(parsed);
      }
    };

    assignDate("issueDate", parseResponse.issueDate);
    assignDate("dueDate", parseResponse.dueDate);
    assignDate("periodStart", parseResponse.periodStart);
    assignDate("periodEnd", parseResponse.periodEnd);

    await updateDocumentWithMetrics(
      docRef,
      updatePayload,
      log,
      "parse_success_update"
    );

    if (normalizedHoaDetails && documentData?.userId) {
      await upsertHoaSummary(documentData.userId, normalizedHoaDetails);
    }

    const updatedDoc = await docRef.get();

    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    log.error("Parse route error", { error });
    return NextResponse.json(
      { error: "Failed to parse document" },
      { status: 500 }
    );
  }
}

function parseDate(value: string): Date | null {
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (isoMatch) {
    return new Date(`${value}T12:00:00Z`);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type ProviderInferenceCache = Map<string, ProviderHint | null>;

function getNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  return value.trim().length > 0 ? value : null;
}

async function updateDocumentWithMetrics(
  ref: DocumentReference,
  payload: Record<string, unknown>,
  log: Logger,
  context: string
) {
  const start = performance.now();
  await ref.update(payload);
  const duration = performance.now() - start;
  log.debug("Firestore write completed", {
    durationMs: Number(duration.toFixed(2)),
    context,
  });
}

function inferProviderFromContent(
  {
    fileName,
    text,
  }: {
    fileName?: string | null;
    text?: string | null;
  },
  memo?: ProviderInferenceCache
): ProviderHint | null {
  const cacheKey = `${fileName ?? ""}:::${text ?? ""}`;
  if (memo?.has(cacheKey)) {
    return memo.get(cacheKey) ?? null;
  }

  const normalizedFileName = fileName ? normalizeSearchValue(fileName) : null;
  const normalizedText = text ? normalizeSearchValue(text) : null;

  if (!normalizedFileName && !normalizedText) {
    memo?.set(cacheKey, null);
    return null;
  }

  const match = findProviderByNormalizedContent({
    normalizedFileName,
    normalizedText,
  });

  memo?.set(cacheKey, match);
  return match;
}

// HOA and credit_card docs frequently mention unrelated providers (e.g. an
// HOA liquidation lists "EDESUR" in its expense rubros). Give those two
// categories higher priority so they always win over specific-provider hints.
const CATEGORY_DETECTION_PRIORITY: Record<string, number> = {
  hoa: 10,
  credit_card: 9,
};

function findProviderByNormalizedContent({
  normalizedFileName,
  normalizedText,
}: {
  normalizedFileName: string | null;
  normalizedText: string | null;
}): ProviderHint | null {
  let best: { hint: ProviderHint; priority: number } | null = null;

  for (const [keyword, hint] of PROVIDER_HINT_KEYWORD_MAP.entries()) {
    if (
      (normalizedFileName && normalizedFileName.includes(keyword)) ||
      (normalizedText && normalizedText.includes(keyword))
    ) {
      const priority = CATEGORY_DETECTION_PRIORITY[hint.category] ?? 0;
      if (!best || priority > best.priority) {
        best = { hint, priority };
        if (priority >= 10) break; // hoa is highest — no need to keep scanning
      }
    }
  }

  return best?.hint ?? null;
}

function getImageMimeType(
  url: string,
  fileName?: string | null
): string | null {
  for (const source of [fileName ?? "", url]) {
    try {
      const path = decodeURIComponent(source).toLowerCase().split("?")[0];
      if (path.endsWith(".png")) return "image/png";
      if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
      if (path.endsWith(".webp")) return "image/webp";
    } catch {
      // ignore malformed URIs
    }
  }
  return null;
}
