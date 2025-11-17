import { z } from "zod"

import { nullableTimestampField } from "./helpers"

/** Schema for POST /api/income requests. */
export const incomeEntrySchema = z.object({
  amount: z.coerce.number({ invalid_type_error: "amount must be numeric" }).positive({ message: "amount must be greater than 0" }),
  source: z.preprocess(
    (value) => {
      if (value === undefined || value === null) return "Salary"
      const normalized = String(value).trim()
      return normalized.length ? normalized : "Salary"
    },
    z.string().min(1, { message: "source is required" }).max(128, { message: "source is too long" }),
  ),
  date: nullableTimestampField(),
})

export type IncomeEntryPayload = z.infer<typeof incomeEntrySchema>
