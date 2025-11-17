import { z } from "zod"

/** Schema for POST /api/parse requests. */
export const parseRequestSchema = z.object({
  documentId: z
    .union([z.string(), z.number()])
    .transform((value) => value.toString().trim())
    .pipe(z.string().min(1, { message: "documentId is required" })),
})

export type ParseRequestPayload = z.infer<typeof parseRequestSchema>
