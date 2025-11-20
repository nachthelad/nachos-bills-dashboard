import type { BillDocument } from "@/lib/firestore-helpers"
import { CATEGORY_OPTIONS, type CategoryValue } from "@/config/billing/categories"

const categoryOrder = CATEGORY_OPTIONS.map((option) => option.value) as CategoryValue[]

export function resolveDocDate(doc: BillDocument): Date | null {
  const candidates: (Date | string | null | undefined)[] = [doc.dueDate, doc.issueDate, doc.periodEnd, doc.periodStart, doc.uploadedAt]
  for (const candidate of candidates) {
    const parsed = candidate instanceof Date ? candidate : candidate ? new Date(candidate) : null
    if (parsed && !Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return null
}

export function labelForCategory(category: (typeof categoryOrder)[number]) {
  switch (category) {
    case "electricity":
      return "Electricity"
    case "water":
      return "Water"
    case "gas":
      return "Gas"
    case "internet":
      return "Mobile / Internet"
    case "hoa":
      return "Home / HOA"
    case "credit_card":
      return "Credit Card"
    default:
      return "Other"
  }
}

export function defaultCategoryTotals(): Record<CategoryValue, number> {
  return categoryOrder.reduce((acc, key) => {
    acc[key] = 0
    return acc
  }, {} as Record<CategoryValue, number>)
}
