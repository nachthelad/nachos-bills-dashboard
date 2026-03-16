import type { ProviderHint } from "@/config/billing/providerHints";
import type { BillingParseResult } from "./parser";

// --- Number parsing ---

function parseArgAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "");
  if (!cleaned) return null;

  // Reject barcodes/reference numbers — real amounts never have more than 12 digits
  const digitCount = (cleaned.match(/\d/g) ?? []).length;
  if (digitCount > 12) return null;

  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const dotCount = (cleaned.match(/\./g) ?? []).length;
  let normalized = cleaned;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".") // 1.234,56
        : cleaned.replace(/,/g, ""); // 1,234.56
  } else if (commaCount === 1 && dotCount === 0) {
    normalized = cleaned.replace(",", "."); // 1234,56
  } else if (commaCount > 1 && dotCount === 0) {
    normalized = cleaned.replace(/,/g, ""); // 1,234,567
  } else if (dotCount > 1 && commaCount === 0) {
    normalized = cleaned.replace(/\./g, ""); // 1.234.567
  }

  const parsed = parseFloat(normalized);
  return isFinite(parsed) && parsed > 0 ? parsed : null;
}

// --- Date helpers ---

const MONTHS: Record<string, number> = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, sep: 9, sept: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
};

function monthNameToNumber(name: string): number | null {
  return MONTHS[name.toLowerCase()] ?? null;
}

function toISODate(day: string, month: string, year: string): string {
  let y: string;
  if (year.length === 2) {
    const num = parseInt(year, 10);
    y = num >= 50 ? `19${year}` : `20${year}`;
  } else {
    y = year;
  }
  return `${y}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function isValidBillDate(isoDate: string): boolean {
  const year = parseInt(isoDate.slice(0, 4), 10);
  return year >= 2000 && year <= 2099;
}

function firstDateInText(text: string): string | null {
  const re = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const date = toISODate(m[1], m[2], m[3]);
    if (isValidBillDate(date)) return date;
  }
  return null;
}

function allDatesInText(text: string): string[] {
  const re = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g;
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const date = toISODate(m[1], m[2], m[3]);
    if (isValidBillDate(date)) results.push(date);
  }
  return results;
}

// --- Line utilities ---

function toLines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
}

// Combine line[i] with line[i+1] to handle labels and values on separate lines
function windowOf(lines: string[], i: number): string {
  return i + 1 < lines.length ? `${lines[i]} ${lines[i + 1]}` : lines[i];
}

// --- Amount ---

const AMOUNT_SCORE: Array<{ re: RegExp; score: number }> = [
  { re: /total\s+a\s+pagar|importe\s+a\s+abonar/i, score: 10 },
  { re: /total\s+factura|total\s+general|importe\s+total/i, score: 8 },
  { re: /total\s+liquidaci[oó]n|total\s+consumo/i, score: 7 },
  { re: /total|importe/i, score: 5 },
  { re: /cuota\s+mensual|cuota/i, score: 3 },
];

function scoreAmountLine(line: string): number {
  for (const { re, score } of AMOUNT_SCORE) {
    if (re.test(line)) return score;
  }
  return 0;
}

function extractAmount(text: string): number | null {
  const lines = toLines(text);

  // Score each individual amount candidate rather than taking max-per-line.
  // Signals: $ prefix (+100), 2-decimal-place format (+50), keyword line score.
  // Reference numbers (invoice IDs, barcodes) have no $ and no decimals → low prec.
  // Tiebreaker: first occurrence in document order (lineIdx asc, matchPos asc).
  const candidates: {
    amount: number;
    prec: number;
    lineIdx: number;
    matchPos: number;
  }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineScore = scoreAmountLine(line);
    if (lineScore === 0) continue;

    // Score the keyword on the current line; extract amounts from the line itself.
    // Only expand to the next line (window) if the current line has no parseable amounts —
    // this prevents window overlap from mixing amounts belonging to different sub-totals.
    const source =
      [...line.matchAll(/([\d.,]{3,})/g)].some(
        (m) => parseArgAmount(m[1]) !== null
      )
        ? line
        : windowOf(lines, i);

    for (const m of source.matchAll(/([\d.,]{3,})/g)) {
      const n = parseArgAmount(m[1]);
      if (n === null) continue;

      const before = source.slice(0, m.index!);
      const hasCurrencyPrefix = /\$\s*$/.test(before);
      const hasDecimalSuffix = /[.,]\d{2}$/.test(m[1]);
      const prec =
        lineScore +
        (hasCurrencyPrefix ? 100 : 0) +
        (hasDecimalSuffix ? 50 : 0);

      candidates.push({ amount: n, prec, lineIdx: i, matchPos: m.index! });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      b.prec - a.prec ||
      a.lineIdx - b.lineIdx ||
      a.matchPos - b.matchPos
  );
  return candidates[0].amount;
}

// --- Due date ---

const DUE_DATE_RE = /venc|vto\b|fecha\s+de\s+pago|fecha\s+l[íi]mite|l[íi]mite\s+de\s+pago/i;
const FIRST_DUE_RE = /1[°º]|primer|primero/i;

function extractDueDate(text: string): string | null {
  const lines = toLines(text);
  let firstDue: string | null = null;
  let anyDue: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!DUE_DATE_RE.test(line)) continue;

    const window = windowOf(lines, i);
    const date = firstDateInText(window);
    if (!date) continue;

    if (FIRST_DUE_RE.test(line) && !firstDue) firstDue = date;
    if (!anyDue) anyDue = date;
  }

  return firstDue ?? anyDue;
}

// --- Issue date ---

const ISSUE_DATE_RE = /emisi[oó]n|fecha\s+factura|fecha\s+de\s+factura|fecha\s+de\s+emisi[oó]n/i;

function extractIssueDate(text: string): string | null {
  const lines = toLines(text);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!ISSUE_DATE_RE.test(line)) continue;

    const date = firstDateInText(windowOf(lines, i));
    if (date) return date;
  }

  return null;
}

// --- Period ---

const PERIOD_RE = /per[íi]odo|periodo|liquidaci[oó]n|facturaci[oó]n/i;

function extractPeriod(text: string): {
  periodStart: string | null;
  periodEnd: string | null;
} {
  const lines = toLines(text);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!PERIOD_RE.test(line)) continue;

    const window = windowOf(lines, i);

    // Two dates in the line → it's a range ("10/12/2025 A 08/01/2026")
    const dates = allDatesInText(window);
    if (dates.length >= 2) {
      return { periodStart: dates[0], periodEnd: dates[1] };
    }

    // Month name + year ("Marzo 2025", "marzo de 2025")
    const monthYear = window.match(
      /([A-Za-záéíóúÁÉÍÓÚ]{4,})\s+(?:de\s+)?(\d{4})/
    );
    if (monthYear) {
      const m = monthNameToNumber(monthYear[1]);
      const y = parseInt(monthYear[2]);
      if (m && y > 2000) {
        const mm = String(m).padStart(2, "0");
        const lastDay = new Date(y, m, 0).getDate();
        return {
          periodStart: `${y}-${mm}-01`,
          periodEnd: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
        };
      }
    }

    // MM/YYYY
    const mmYYYY = window.match(/\b(\d{2})\/(\d{4})\b/);
    if (mmYYYY) {
      const m = parseInt(mmYYYY[1]);
      const y = parseInt(mmYYYY[2]);
      if (m >= 1 && m <= 12 && y > 2000) {
        const mm = String(m).padStart(2, "0");
        const lastDay = new Date(y, m, 0).getDate();
        return {
          periodStart: `${y}-${mm}-01`,
          periodEnd: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
        };
      }
    }
  }

  return { periodStart: null, periodEnd: null };
}

// --- Currency ---

function extractCurrency(text: string): string {
  return /USD|U\$S|d[oó]lar/i.test(text) ? "USD" : "ARS";
}

// --- Main ---

export function parseWithRules(
  text: string,
  providerHint: ProviderHint
): BillingParseResult {
  const { periodStart, periodEnd } = extractPeriod(text);
  return {
    text,
    providerId: providerHint.providerId,
    providerNameDetected: providerHint.providerName,
    category: providerHint.category,
    totalAmount: extractAmount(text),
    currency: extractCurrency(text),
    issueDate: extractIssueDate(text),
    dueDate: extractDueDate(text),
    periodStart,
    periodEnd,
    hoaDetails: null,
  };
}
