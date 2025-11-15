import { CATEGORY_SET, type CategoryValue } from "@/config/billing/categories"
import { PROVIDER_KEYWORDS } from "@/config/billing/providerKeywords"

export function normalizeCategory(
  providerId?: string | null,
  rawCategory?: string | null,
  providerName?: string | null,
): CategoryValue {
  const normalizedCategory = normalizeValue(rawCategory)
  if (normalizedCategory && CATEGORY_SET.has(normalizedCategory as CategoryValue)) {
    return normalizedCategory as CategoryValue
  }

  const searchValues = [providerId, providerName, rawCategory].map((value) => normalizeValue(value))
  for (const { value, keywords } of PROVIDER_KEYWORDS) {
    if (keywords.some((keyword) => searchValues.some((search) => search && search.includes(keyword)))) {
      return value
    }
  }

  if (normalizedCategory === "service" || normalizedCategory === "services") {
    return "other"
  }

  return "other"
}

export function normalizeSearchValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function normalizeValue(value?: string | null): string | null {
  if (!value) return null
  return normalizeSearchValue(value)
}
