export const CATEGORY_OPTIONS = [
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "gas", label: "Gas" },
  { value: "internet", label: "Internet / Mobile" },
  { value: "hoa", label: "Home / HOA" },
  { value: "credit_card", label: "Credit Card" },
  { value: "other", label: "Other" },
] as const

export type CategoryValue = (typeof CATEGORY_OPTIONS)[number]["value"]

export const CATEGORY_SET = new Set<CategoryValue>(CATEGORY_OPTIONS.map((option) => option.value))
