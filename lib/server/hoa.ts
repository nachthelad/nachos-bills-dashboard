import type { Timestamp } from "firebase-admin/firestore"
import { toNonEmptyString, toNumber, toInteger } from "@/lib/utils"

export type HoaTotals = {
  rubrosTotal: number | null
  rubrosWithTotals: number
}

export type NormalizedHoaRubro = {
  rubroNumber: number | null
  label: string | null
  total: number | null
}

export type NormalizedHoaDetails = {
  buildingCode: string | null
  buildingAddress: string | null
  unitCode: string | null
  unitLabel: string | null
  ownerName: string | null
  periodYear: number | null
  periodMonth: number | null
  periodLabel: string | null
  periodKey: string | null
  totalToPayUnit: number | null
  totalBuildingExpenses: number | null
  rubros: NormalizedHoaRubro[]
  [key: string]: unknown
}

export function normalizeHoaDetails(
  details: unknown
): NormalizedHoaDetails | null {
  if (!details || typeof details !== "object") {
    return null
  }

  const source = details as Record<string, unknown>
  const buildingCode = toNonEmptyString(source.buildingCode)
  const buildingAddress = toNonEmptyString(source.buildingAddress)
  const unitCode = toNonEmptyString(source.unitCode)
  const unitLabel = toNonEmptyString(source.unitLabel)
  const ownerName = toNonEmptyString(source.ownerName)
  const periodYear = toInteger(source.periodYear)
  const periodMonth = toInteger(source.periodMonth)
  const periodKey = buildHoaPeriodKey(periodYear, periodMonth)
  const periodLabel =
    toNonEmptyString(source.periodLabel) ??
    (periodYear && periodMonth
      ? `${String(periodMonth).padStart(2, "0")}/${periodYear}`
      : null)
  const totalToPayUnit = toNumber(source.totalToPayUnit)
  const totalBuildingExpenses = toNumber(source.totalBuildingExpenses)
  const rubros = Array.isArray(source.rubros)
    ? source.rubros.map((r) => normalizeHoaRubro(r))
    : []

  return {
    ...source,
    buildingCode,
    buildingAddress,
    unitCode,
    unitLabel,
    ownerName,
    periodYear,
    periodMonth,
    periodLabel,
    periodKey,
    totalToPayUnit,
    totalBuildingExpenses,
    rubros,
  }
}

export function isNormalizedHoaDetails(
  value: unknown
): value is NormalizedHoaDetails {
  if (!value || typeof value !== "object") {
    return false
  }
  const candidate = value as Record<string, unknown>
  return Array.isArray(candidate.rubros)
}

export function buildHoaPeriodKey(
  year: number | string | null | undefined,
  month: number | string | null | undefined
): string | null {
  const numericYear = toInteger(year)
  const numericMonth = toInteger(month)
  if (!numericYear || !numericMonth) {
    return null
  }
  return `${numericYear}-${String(numericMonth).padStart(2, "0")}`
}

export function calculateHoaTotals(
  rubros: NormalizedHoaRubro[] | null | undefined
): HoaTotals {
  if (!Array.isArray(rubros) || rubros.length === 0) {
    return { rubrosTotal: null, rubrosWithTotals: 0 }
  }

  let total = 0
  let rubrosWithTotals = 0

  for (const rubro of rubros) {
    if (rubro && typeof rubro.total === "number" && Number.isFinite(rubro.total)) {
      total += rubro.total
      rubrosWithTotals += 1
    }
  }

  return {
    rubrosTotal: rubrosWithTotals > 0 ? total : null,
    rubrosWithTotals,
  }
}

export function normalizeHoaSummaryPayload(options: {
  userId: string
  hoaDetails: NormalizedHoaDetails
  now: Timestamp
}) {
  const { userId, hoaDetails, now } = options
  const periodKey =
    hoaDetails.periodKey ??
    buildHoaPeriodKey(hoaDetails.periodYear, hoaDetails.periodMonth)

  return {
    userId,
    buildingCode: hoaDetails.buildingCode,
    buildingAddress: hoaDetails.buildingAddress,
    unitCode: hoaDetails.unitCode,
    unitLabel: hoaDetails.unitLabel,
    ownerName: hoaDetails.ownerName,
    periodKey,
    periodYear: hoaDetails.periodYear,
    periodMonth: hoaDetails.periodMonth,
    periodLabel:
      hoaDetails.periodLabel ??
      (hoaDetails.periodMonth && hoaDetails.periodYear
        ? `${String(hoaDetails.periodMonth).padStart(2, "0")}/${hoaDetails.periodYear}`
        : null),
    totalToPayUnit: hoaDetails.totalToPayUnit,
    totalBuildingExpenses: hoaDetails.totalBuildingExpenses,
    rubros: hoaDetails.rubros,
    updatedAt: now,
  }
}

function normalizeHoaRubro(input: unknown): NormalizedHoaRubro {
  const rubro = (input ?? {}) as Record<string, unknown>
  const rubroNumber = toInteger(rubro.rubroNumber)
  const label = toNonEmptyString(rubro.label)
  const total = toNumber(rubro.total)
  return {
    rubroNumber,
    label,
    total,
  }
}


