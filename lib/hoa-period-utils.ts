/**
 * Formats an HOA period (month and year) into a standardized Spanish label.
 * Example: formatHoaPeriod(10, 2025) -> "OCTUBRE/2025"
 */
export function formatHoaPeriod(
  month: number | null | undefined,
  year: number | null | undefined
): string | null {
  if (!month || !year) return null;

  try {
    const date = new Date(year, month - 1, 1);
    const monthName = new Intl.DateTimeFormat("es-AR", {
      month: "long",
    }).format(date);
    return `${monthName.toUpperCase()}/${year}`;
  } catch (error) {
    console.error("Error formatting HOA period:", error);
    // Fallback to numeric if somehow Intl fails
    return `${String(month).padStart(2, "0")}/${year}`;
  }
}

/**
 * Checks if a label is in the numeric format "MM/YYYY" and attempts to convert it to "MES/YYYY".
 */
export function ensureSpanishPeriodLabel(
  label: string | null | undefined
): string | null {
  if (!label) return null;

  // Match "MM/YYYY" or "M/YYYY"
  const numericMatch = label.match(/^(\d{1,2})\/(\d{4})$/);
  if (numericMatch) {
    const month = parseInt(numericMatch[1], 10);
    const year = parseInt(numericMatch[2], 10);
    return formatHoaPeriod(month, year) || label;
  }

  return label;
}
