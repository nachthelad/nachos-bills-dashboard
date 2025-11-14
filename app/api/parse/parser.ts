import type { HoaDetails, HoaRubro } from "@/types/hoa"

export type BillingParseResult = {
  text: string | null
  providerId: string | null
  providerNameDetected: string | null
  category: string | null
  totalAmount: number | null
  currency: string | null
  issueDate: string | null
  dueDate: string | null
  periodStart: string | null
  periodEnd: string | null
  hoaDetails: HoaDetails | null
}

type JsonSchema = {
  type: "json_schema"
  json_schema: {
    name: string
    schema: Record<string, unknown>
  }
}

export const BILL_PARSER_SCHEMA: JsonSchema = {
  type: "json_schema",
  json_schema: {
    name: "billing_parse_result",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        text: { type: "string" },
        providerId: { anyOf: [{ type: "string" }, { type: "null" }] },
        providerNameDetected: { anyOf: [{ type: "string" }, { type: "null" }] },
        category: { anyOf: [{ type: "string" }, { type: "null" }] },
        totalAmount: { anyOf: [{ type: "number" }, { type: "null" }] },
        currency: { anyOf: [{ type: "string" }, { type: "null" }] },
        issueDate: { anyOf: [{ type: "string" }, { type: "null" }] },
        dueDate: { anyOf: [{ type: "string" }, { type: "null" }] },
        periodStart: { anyOf: [{ type: "string" }, { type: "null" }] },
        periodEnd: { anyOf: [{ type: "string" }, { type: "null" }] },
        hoaDetails: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                buildingCode: { anyOf: [{ type: "string" }, { type: "null" }] },
                buildingAddress: { anyOf: [{ type: "string" }, { type: "null" }] },
                unitCode: { anyOf: [{ type: "string" }, { type: "null" }] },
                unitLabel: { anyOf: [{ type: "string" }, { type: "null" }] },
                ownerName: { anyOf: [{ type: "string" }, { type: "null" }] },
                periodLabel: { anyOf: [{ type: "string" }, { type: "null" }] },
                periodYear: { anyOf: [{ type: "number" }, { type: "null" }] },
                periodMonth: { anyOf: [{ type: "number" }, { type: "null" }] },
                firstDueAmount: { anyOf: [{ type: "number" }, { type: "null" }] },
                secondDueAmount: { anyOf: [{ type: "number" }, { type: "null" }] },
                totalBuildingExpenses: { anyOf: [{ type: "number" }, { type: "null" }] },
                totalToPayUnit: { anyOf: [{ type: "number" }, { type: "null" }] },
                rubros: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      rubroNumber: { anyOf: [{ type: "number" }, { type: "null" }] },
                      label: { anyOf: [{ type: "string" }, { type: "null" }] },
                      total: { anyOf: [{ type: "number" }, { type: "null" }] },
                    },
                    required: ["rubroNumber", "label", "total"],
                  },
                },
              },
              required: [
                "buildingCode",
                "buildingAddress",
                "unitCode",
                "unitLabel",
                "ownerName",
                "periodLabel",
                "periodYear",
                "periodMonth",
                "firstDueAmount",
                "secondDueAmount",
                "totalBuildingExpenses",
                "totalToPayUnit",
                "rubros",
              ],
            },
          ],
        },
      },
      required: ["text"],
    },
  },
}

export const OPENAI_SYSTEM_PROMPT = `You are a meticulous assistant that extracts structured billing data from PDF text. Always respond with JSON that strictly matches the provided schema.`

export const OPENAI_USER_PROMPT = `Analyze the following PDF text and extract any billing related metadata. Use the schema fields and return null when information cannot be determined.`

type ResponsesCreateArgs = {
  model: string
  input: Array<{
    role: string
    content: Array<{ type: string; text: string }>
  }>
  response_format: JsonSchema
}

type OpenAIResponse = {
  output_text?: string
  output?: Array<
    | { type: "message"; content?: Array<{ type: string; text?: string }> }
    | { type: string; text?: string }
  >
}

class OpenAIClient {
  constructor(private readonly apiKey: string, private readonly baseUrl?: string) {}

  private get url() {
    return this.baseUrl?.replace(/\/$/, "") || "https://api.openai.com/v1"
  }

  responses = {
    create: async (body: ResponsesCreateArgs) => {
      const response = await fetch(`${this.url}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI request failed with ${response.status}: ${errorText}`)
      }

      return (await response.json()) as OpenAIResponse
    },
  }
}

let cachedClient: OpenAIClient | null = null

export function getOpenAIClient(): OpenAIClient {
  if (!cachedClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured")
    }
    const baseUrl = process.env.OPENAI_BASE_URL
    cachedClient = new OpenAIClient(apiKey, baseUrl)
  }
  return cachedClient
}

function sanitizeString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim()
  }
  return null
}

function sanitizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const numeric = trimmed.replace(/[^0-9.,-]+/g, "")
  if (!numeric) {
    return null
  }

  const commaCount = (numeric.match(/,/g) ?? []).length
  const dotCount = (numeric.match(/\./g) ?? []).length
  let normalized = numeric

  if (commaCount && dotCount) {
    const lastComma = numeric.lastIndexOf(",")
    const lastDot = numeric.lastIndexOf(".")
    if (lastComma > lastDot) {
      normalized = numeric.replace(/\./g, "").replace(/,/g, ".")
    } else {
      normalized = numeric.replace(/,/g, "")
    }
  } else if (commaCount === 1 && dotCount === 0) {
    normalized = numeric.replace(/,/g, ".")
  } else if (commaCount > 1 && dotCount === 0) {
    normalized = numeric.replace(/,/g, "")
  } else if (dotCount > 1 && commaCount === 0) {
    normalized = numeric.replace(/\./g, "")
  }

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function sanitizeInteger(value: unknown): number | null {
  const numeric = sanitizeNumber(value)
  if (numeric === null) return null
  const rounded = Math.round(numeric)
  return Number.isFinite(rounded) ? rounded : null
}

function sanitizeHoaRubros(value: unknown): HoaRubro[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return { rubroNumber: null, label: null, total: null }
      }
      const rubro = item as Record<string, unknown>
      return {
        rubroNumber: sanitizeInteger(rubro.rubroNumber),
        label: sanitizeString(rubro.label),
        total: sanitizeNumber(rubro.total),
      }
    })
}

function sanitizeHoaDetails(value: unknown): HoaDetails | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const details = value as Record<string, unknown>
  return {
    buildingCode: sanitizeString(details.buildingCode),
    buildingAddress: sanitizeString(details.buildingAddress),
    unitCode: sanitizeString(details.unitCode),
    unitLabel: sanitizeString(details.unitLabel),
    ownerName: sanitizeString(details.ownerName),
    periodLabel: sanitizeString(details.periodLabel),
    periodYear: sanitizeInteger(details.periodYear),
    periodMonth: sanitizeInteger(details.periodMonth),
    firstDueAmount: sanitizeNumber(details.firstDueAmount),
    secondDueAmount: sanitizeNumber(details.secondDueAmount),
    totalBuildingExpenses: sanitizeNumber(details.totalBuildingExpenses),
    totalToPayUnit: sanitizeNumber(details.totalToPayUnit),
    rubros: sanitizeHoaRubros(details.rubros),
  }
}

export function sanitizeBillingResult(value: unknown): BillingParseResult {
  const data = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    text: sanitizeString(data.text),
    providerId: sanitizeString(data.providerId),
    providerNameDetected: sanitizeString(data.providerNameDetected),
    category: sanitizeString(data.category),
    totalAmount: sanitizeNumber(data.totalAmount),
    currency: sanitizeString(data.currency),
    issueDate: sanitizeString(data.issueDate),
    dueDate: sanitizeString(data.dueDate),
    periodStart: sanitizeString(data.periodStart),
    periodEnd: sanitizeString(data.periodEnd),
    hoaDetails: sanitizeHoaDetails(data.hoaDetails),
  }
}

export function extractJsonFromResponse(response: OpenAIResponse): string {
  if (response.output_text && response.output_text.trim().length > 0) {
    return response.output_text.trim()
  }

  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (!item) continue
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const content of item.content) {
          if (content?.text) {
            return content.text
          }
        }
      }
      if (typeof item.text === "string" && item.text.trim().length > 0) {
        return item.text.trim()
      }
    }
  }

  throw new Error("No JSON text found in OpenAI response")
}

function toLines(fullText: string): string[] {
  return fullText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function extractRelevantText(fullText: string): string {
  const lines = toLines(fullText)
  const firstLines = lines.slice(0, 60)
  const lastLines = lines.slice(-40)
  const moneyLines = lines.filter((line) =>
    /(\$|TOTAL|Total|Importe|Vencim|VENCIM|Periodo|Período)/i.test(line),
  )
  const uniqueMoneyLines = Array.from(new Set(moneyLines))
  const combined = [
    "=== FIRST LINES ===",
    ...firstLines,
    "=== MONEY LINES ===",
    ...uniqueMoneyLines,
    "=== LAST LINES ===",
    ...lastLines,
  ].join("\n")

  const MAX_CHARS = 8000
  return combined.slice(0, MAX_CHARS)
}

async function loadPdfParse() {
  const module = await import("pdf-parse")
  const pdfParse = (module as { default?: (buffer: Buffer) => Promise<{ text?: string }> }).default ?? module
  if (typeof pdfParse !== "function") {
    throw new Error("Invalid pdf-parse module")
  }
  return pdfParse as (buffer: Buffer) => Promise<{ text?: string }>
}

export async function parsePdfWithOpenAI(pdfBuffer: Buffer): Promise<BillingParseResult> {
  const pdfParse = await loadPdfParse()
  const pdfData = await pdfParse(pdfBuffer)
  const fullText = typeof pdfData?.text === "string" ? pdfData.text : ""
  const relevantText = extractRelevantText(fullText)

  const client = getOpenAIClient()
  const response = await client.responses.create({
    model: "gpt-5.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: OPENAI_SYSTEM_PROMPT,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `${OPENAI_USER_PROMPT}\n\n${relevantText}`,
          },
        ],
      },
    ],
    response_format: BILL_PARSER_SCHEMA,
  })

  const jsonText = extractJsonFromResponse(response)
  const parsed = JSON.parse(jsonText)
  const sanitized = sanitizeBillingResult(parsed)
  return {
    ...sanitized,
    text: sanitized.text ?? (fullText.length > 0 ? fullText : null),
  }
}

