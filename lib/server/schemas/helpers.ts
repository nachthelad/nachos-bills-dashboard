import { Timestamp } from "firebase-admin/firestore"
import { z } from "zod"

/**
 * Normalizes arbitrary date inputs (ISO strings, epoch values, Date objects)
 * into a JavaScript Date object anchored at midnight UTC when possible.
 */
export function normalizeDateInput(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") {
    return null
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00Z`)
    }
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in (value as Record<string, unknown>)
  ) {
    try {
      return (value as { toDate: () => Date }).toDate()
    } catch {
      return null
    }
  }

  return null
}

/** Converts the provided value into a Firestore Timestamp, if possible. */
export function toFirestoreTimestamp(value: unknown): Timestamp | null {
  if (value instanceof Timestamp) {
    return value
  }
  const normalized = normalizeDateInput(value)
  return normalized ? Timestamp.fromDate(normalized) : null
}

const timestampSchema = z.instanceof(Timestamp)

export function nullableStringField(options?: { maxLength?: number }) {
  const maxLength = options?.maxLength ?? 512
  return z.preprocess(
    (value) => {
      if (value === undefined) return undefined
      if (value === null) return null
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        const normalized = String(value).trim()
        return normalized.length ? normalized : null
      }
      return null
    },
    z.union([z.string().max(maxLength), z.null()]).optional(),
  )
}

export function nullableUrlField() {
  return z.preprocess(
    (value) => {
      if (value === undefined) return undefined
      if (value === null || value === "") return null
      if (typeof value === "string") {
        return value.trim()
      }
      return null
    },
    z.union([z.string().url(), z.null()]).optional(),
  )
}

export function nullableNumberField(options?: { min?: number; max?: number }) {
  const baseNumber = (() => {
    let schema = z.number()
    if (typeof options?.min === "number") {
      schema = schema.min(options.min)
    }
    if (typeof options?.max === "number") {
      schema = schema.max(options.max)
    }
    return schema
  })()

  return z.preprocess(
    (value) => {
      if (value === undefined) return undefined
      if (value === null || value === "") return null
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    },
    z.union([baseNumber, z.null()]).optional(),
  )
}

export function nullableCurrencyField() {
  return z.preprocess(
    (value) => {
      if (value === undefined) return undefined
      if (value === null) return null
      if (typeof value === "string") {
        const trimmed = value.trim()
        return trimmed ? trimmed.toUpperCase() : null
      }
      return null
    },
    z
      .union([z.string().length(3, { message: "Currency must be a 3-letter ISO code" }), z.null()])
      .optional(),
  )
}

export function nullableTimestampField() {
  return z.preprocess(
    (value) => {
      if (value === undefined) return undefined
      return toFirestoreTimestamp(value)
    },
    z.union([timestampSchema, z.null()]).optional(),
  )
}
