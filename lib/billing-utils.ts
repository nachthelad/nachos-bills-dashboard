import type { BillDocument } from "@/lib/firestore-helpers";
import {
  CATEGORY_OPTIONS,
  type CategoryValue,
} from "@/config/billing/categories";

const categoryOrder = CATEGORY_OPTIONS.map(
  (option) => option.value
) as CategoryValue[];

export function parseLocalDay(
  value: string | Date | null | undefined
): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;

  // Handle YYYY-MM-DD strings explicitly as local time
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveDocDate(doc: BillDocument): Date | null {
  const candidates: (Date | string | null | undefined)[] = [
    doc.dueDate,
    doc.issueDate,
    doc.periodEnd,
    doc.periodStart,
    doc.uploadedAt,
  ];
  for (const candidate of candidates) {
    const date = parseLocalDay(candidate);
    if (date) return date;
  }
  return null;
}

export function labelForCategory(category: string | null | undefined) {
  switch (category) {
    case "electricity":
      return "Electricity";
    case "water":
      return "Water";
    case "gas":
      return "Gas";
    case "internet":
      return "Mobile / Internet";
    case "hoa":
      return "HOA";
    case "credit_card":
      return "Credit Card";
    default:
      return "Other";
  }
}

export function defaultCategoryTotals(): Record<CategoryValue, number> {
  return categoryOrder.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<CategoryValue, number>);
}
