import { z } from "zod"

import {
  nullableCurrencyField,
  nullableNumberField,
  nullableStringField,
  nullableTimestampField,
  nullableUrlField,
} from "./helpers"

/**
 * Schema that documents the payload accepted by POST /api/documents when a
 * client creates a new bill record.
 */
export const documentCreateSchema = z.object({
  fileName: z
    .string({ required_error: "fileName is required" })
    .min(1, { message: "fileName is required" })
    .max(512, { message: "fileName is too long" })
    .transform((value) => value.trim()),
  storageUrl: nullableUrlField(),
  provider: nullableStringField({ maxLength: 256 }),
  providerId: nullableStringField({ maxLength: 128 }),
  category: nullableStringField({ maxLength: 64 }),
  amount: nullableNumberField({ min: 0 }),
  totalAmount: nullableNumberField({ min: 0 }),
  currency: nullableCurrencyField(),
  dueDate: nullableTimestampField(),
  issueDate: nullableTimestampField(),
  periodStart: nullableTimestampField(),
  periodEnd: nullableTimestampField(),
  manualEntry: z.coerce.boolean().optional().default(false),
  textExtract: nullableStringField({ maxLength: 20_000 }),
})

/**
 * Schema describing the editable subset of fields accepted by
 * PATCH /api/documents/[id].
 */
export const documentUpdateSchema = z.object({
  provider: nullableStringField({ maxLength: 256 }),
  amount: nullableNumberField({ min: 0 }),
  dueDate: nullableTimestampField(),
  status: z
    .enum(["pending", "parsed", "needs_review", "error"]) // existing statuses
    .optional(),
  category: nullableStringField({ maxLength: 64 }),
  issueDate: nullableTimestampField(),
  periodStart: nullableTimestampField(),
  periodEnd: nullableTimestampField(),
  totalAmount: nullableNumberField({ min: 0 }),
  currency: nullableCurrencyField(),
})

export type DocumentCreatePayload = z.infer<typeof documentCreateSchema>
export type DocumentUpdatePayload = z.infer<typeof documentUpdateSchema>
