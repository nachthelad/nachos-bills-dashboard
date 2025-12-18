import { z } from "zod";

export const billDocumentSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  fileName: z.string(),
  storageUrl: z.string().url().optional().nullable(),
  pdfUrl: z.string().optional().nullable(),
  uploadedAt: z.string().optional().nullable(),
  provider: z.string().optional().nullable(),
  providerId: z.string().optional().nullable(),
  providerNameDetected: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  totalAmount: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  issueDate: z.string().optional().nullable(),
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable(),
  status: z.enum(["pending", "parsed", "needs_review", "error", "paid"]),
  textExtract: z.string().optional().nullable(),
  errorMessage: z.string().optional().nullable(),
  lastParsedAt: z.string().optional().nullable(),
  hoaDetails: z.unknown().optional(),
  manualEntry: z.boolean().optional(),
  updatedAt: z.string().optional().nullable(),
});

export const listDocumentsResponseSchema = z.object({
  documents: z.array(billDocumentSchema).default([]),
});

export const createDocumentRequestSchema = z.object({
  fileName: z.string().min(1),
  storageUrl: z.string().url().nullable().optional(),
  provider: z.string().optional().nullable(),
  providerId: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  totalAmount: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  issueDate: z.string().optional().nullable(),
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable(),
  manualEntry: z.boolean().optional(),
  textExtract: z.string().optional().nullable(),
});

export const createDocumentResponseSchema = z.object({
  documentId: z.string(),
});

export const parseDocumentRequestSchema = z.object({
  documentId: z.string().min(1),
});

export const parseDocumentResponseSchema = z
  .object({
    id: z.string(),
  })
  .passthrough();

const numberRecordSchema = z.record(z.number());

export const dashboardTotalsSchema = z.object({
  totalExpensesYear: z.number(),
  totalIncomeYear: z.number(),
  netAmount: z.number(),
  monthExpenses: z.number(),
});

export const dashboardSummarySchema = z.object({
  totals: dashboardTotalsSchema,
  categories: numberRecordSchema,
  incomeSources: numberRecordSchema,
  updatedAt: z.string().optional().nullable(),
});

export const dashboardSummaryResponseSchema = z.object({
  summary: dashboardSummarySchema.nullable(),
});

export const saveDashboardSummaryResponseSchema = z.object({
  success: z.boolean(),
});

export const uploadResponseSchema = z.object({
  storageUrl: z.string().url(),
  filePath: z.string(),
  checksum: z.string(),
  size: z.number(),
  upload: z
    .object({
      resumable: z.boolean(),
      maxSize: z.string(),
      allowedTypes: z.string(),
    })
    .optional(),
});

export type ApiBillDocument = z.infer<typeof billDocumentSchema>;
export type CreateDocumentPayload = z.input<typeof createDocumentRequestSchema>;
export type DashboardSummaryPayload = z.infer<typeof dashboardSummarySchema>;
export type UploadResponse = z.infer<typeof uploadResponseSchema>;
