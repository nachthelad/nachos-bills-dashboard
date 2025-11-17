import type { DocumentSnapshot } from "firebase-admin/firestore"

type MaybeTimestamp = {
  toDate?: () => Date
}

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

  return {
    ...base,
    uploadedAt: toIsoDateTime(data.uploadedAt),
    issueDate: toIsoDate(data.issueDate),
    dueDate: toIsoDate(data.dueDate),
    periodStart: toIsoDate(data.periodStart),
    periodEnd: toIsoDate(data.periodEnd),
    lastParsedAt: toIsoDateTime(data.lastParsedAt),
  }
}
