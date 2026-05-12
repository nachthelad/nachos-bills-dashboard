import type { DocumentSnapshot } from "firebase-admin/firestore"

type MaybeTimestamp = {
  toDate?: () => Date
}

const SUPPORTED_DOCUMENT_STATUSES = new Set([
  "pending",
  "parsed",
  "needs_review",
  "error",
  "paid",
])

export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "string") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  if (typeof value === "object" && value !== null && "toDate" in (value as MaybeTimestamp)) {
    try {
      return (value as MaybeTimestamp).toDate?.() ?? null
    } catch {
      return null
    }
  }
  return null
}

export function toIsoDate(value: unknown, fallback: string | null = null): string | null {
  const parsed = toDate(value)
  if (!parsed) return fallback
  return parsed.toISOString().slice(0, 10)
}

export function toIsoDateTime(value: unknown, fallback: string | null = null): string | null {
  const parsed = toDate(value)
  if (!parsed) return fallback
  return parsed.toISOString()
}

export function serializeSnapshot<T extends Record<string, unknown>>(
  doc: DocumentSnapshot<T>,
): T & { id: string } {
  const data = (doc.data() ?? {}) as T & { id?: string }
  const { id: _ignoredId, ...rest } = data
  return {
    ...(rest as T),
    id: doc.id,
  }
}

export function serializeDocumentSnapshot(doc: DocumentSnapshot): Record<string, any> {
  const data = doc.data() ?? {}
  const base = serializeSnapshot(doc)
  const rawStatus = typeof data.status === "string" ? data.status : null
  const normalizedStatus =
    rawStatus === "parse_failed"
      ? "error"
      : rawStatus && SUPPORTED_DOCUMENT_STATUSES.has(rawStatus)
        ? rawStatus
        : "needs_review"
  const rawParserError =
    typeof data.last_parser_error === "string" ? data.last_parser_error : null
  const rawErrorMessage =
    typeof data.errorMessage === "string" ? data.errorMessage : null
  const effectiveErrorMessage =
    rawErrorMessage ?? (normalizedStatus === "error" ? rawParserError : null)

  return {
    ...base,
    status: normalizedStatus,
    errorMessage: effectiveErrorMessage,
    uploadedAt: toIsoDateTime(data.uploadedAt),
    issueDate: toIsoDate(data.issueDate),
    dueDate: toIsoDate(data.dueDate),
    periodStart: toIsoDate(data.periodStart),
    periodEnd: toIsoDate(data.periodEnd),
    lastParsedAt: toIsoDateTime(data.lastParsedAt),
    updatedAt: toIsoDateTime(data.updatedAt),
  }
}
