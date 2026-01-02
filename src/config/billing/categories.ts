export const CATEGORY_OPTIONS = [
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "gas", label: "Gas" },
  { value: "internet", label: "Internet / Mobile" },
  { value: "hoa", label: "Home / HOA" },
  { value: "health", label: "Health" },
  { value: "credit_card", label: "Credit Card" },
  { value: "other", label: "Other" },
] as const;

export type CategoryValue = (typeof CATEGORY_OPTIONS)[number]["value"];

export const CATEGORY_SET = new Set<CategoryValue>(
  CATEGORY_OPTIONS.map((option) => option.value)
);

/**
 * Get the display label for a category value
 */
export function getCategoryLabel(category: string | null | undefined): string {
  const option = CATEGORY_OPTIONS.find((opt) => opt.value === category);
  return option?.label ?? "Other";
}
