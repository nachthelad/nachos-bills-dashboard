import { CATEGORY_SET, type CategoryValue } from "@/config/billing/categories";
import { PROVIDER_HINTS } from "@/config/billing/providerHints";

export function normalizeCategory(
  providerId?: string | null,
  rawCategory?: string | null,
  providerName?: string | null
): CategoryValue {
  // 1. Check PROVIDER_HINTS first (most specific by ID)
  if (providerId) {
    const hint = PROVIDER_HINTS.find((h) => h.providerId === providerId);
    if (hint) return hint.category;
  }

  // 2. Check if rawCategory is already a valid category value
  const normalizedCategoryValue = normalizeValue(rawCategory);
  if (
    normalizedCategoryValue &&
    CATEGORY_SET.has(normalizedCategoryValue as CategoryValue)
  ) {
    return normalizedCategoryValue as CategoryValue;
  }

  // 3. Keyword matching using PROVIDER_HINTS
  const searchValues = [providerId, providerName, rawCategory].map((value) =>
    normalizeValue(value)
  );
  for (const hint of PROVIDER_HINTS) {
    if (
      hint.keywords.some((keyword) => {
        const normalizedKeyword = normalizeSearchValue(keyword);
        return searchValues.some(
          (search) => search && search.includes(normalizedKeyword)
        );
      })
    ) {
      return hint.category;
    }
  }

  if (
    normalizedCategoryValue === "service" ||
    normalizedCategoryValue === "services"
  ) {
    return "other";
  }

  return "other";
}

export function normalizeSearchValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeValue(value?: string | null): string | null {
  if (!value) return null;
  return normalizeSearchValue(value);
}
