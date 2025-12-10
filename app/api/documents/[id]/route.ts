import { NextRequest, NextResponse } from "next/server";

import { Timestamp } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase-admin";
import { serializeDocumentSnapshot } from "@/lib/server/document-serializer";
import {
  authenticateRequest,
  handleAuthError,
} from "@/lib/server/authenticate-request";
import { createRequestLogger } from "@/lib/server/logger";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function resolveParams(params: RouteContext["params"]) {
  return typeof (params as any).then === "function"
    ? await (params as Promise<{ id: string }>)
    : (params as { id: string });
}

async function getAuthorizedDocument(
  request: NextRequest,
  params: RouteContext["params"]
) {
  const { uid } = await authenticateRequest(request);
  const resolvedParams = await resolveParams(params);
  const docRef = getAdminFirestore()
    .collection("documents")
    .doc(resolvedParams.id);
  const docSnapshot = await docRef.get();

  if (!docSnapshot.exists) {
    return {
      errorResponse: NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      ),
    };
  }

  const documentData = docSnapshot.data();
  if (documentData?.userId && documentData.userId !== uid) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { docRef, docSnapshot, uid };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "GET /api/documents/[id]" },
  });
  let log = baseLogger;
  try {
    const authResult = await getAuthorizedDocument(request, context.params);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }

    log = log.withContext({ userId: authResult.uid });

    return NextResponse.json(serializeDocumentSnapshot(authResult.docSnapshot));
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    log.error("Document GET error", { error });
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "PATCH /api/documents/[id]" },
  });
  let log = baseLogger;
  try {
    const authResult = await getAuthorizedDocument(request, context.params);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }

    log = log.withContext({ userId: authResult.uid });

    const { docRef } = authResult;
    const {
      provider,
      amount,
      dueDate,
      status,
      category,
      issueDate,
      periodStart,
      periodEnd,
    } = await request.json();

    const updates: Record<string, any> = {};

    if (provider !== undefined) updates.provider = provider || null;
    if (amount !== undefined) updates.amount = amount ?? null;
    if (status) updates.status = status;
    if (category !== undefined) updates.category = category || null;

    const assignDate = (field: string, value: any) => {
      if (value === undefined) return;
      updates[field] = value
        ? Timestamp.fromDate(new Date(`${value}T12:00:00Z`))
        : null;
    };

    assignDate("dueDate", dueDate);
    assignDate("issueDate", issueDate);
    assignDate("periodStart", periodStart);
    assignDate("periodEnd", periodEnd);

    updates.updatedAt = new Date();

    await docRef.update(updates);
    const updatedSnapshot = await docRef.get();

    return NextResponse.json(serializeDocumentSnapshot(updatedSnapshot));
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    log.error("Document PATCH error", { error });
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const baseLogger = createRequestLogger({
    request,
    context: { route: "DELETE /api/documents/[id]" },
  });
  let log = baseLogger;
  try {
    const authResult = await getAuthorizedDocument(request, context.params);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }

    log = log.withContext({ userId: authResult.uid });

    const { docRef } = authResult;
    await docRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) {
      return authResponse;
    }
    log.error("Document DELETE error", { error });
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
