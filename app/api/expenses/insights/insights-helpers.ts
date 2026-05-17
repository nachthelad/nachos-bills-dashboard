export interface InsightExpenseEntry {
  amount: number;
  category: string;
  description: string;
  date: string;
  currency?: string;
  arsRate?: number | null;
}

export interface InsightIncomeEntry {
  amount: number;
  source: string;
  name: string;
  date: string;
}

export interface InsightBill {
  providerName: string;
  totalAmount: number;
  category: string | null;
  dueDate?: string;
  issueDate?: string;
  periodStart?: string;
}

export interface InsightHoaSummary {
  periodKey?: string;
  periodLabel?: string;
  totalToPayUnit?: number;
}

export interface AnalysisPeriod {
  monthFilter: string;
  monthLabel: string;
  usesCurrentMonthFallback: boolean;
}

export interface InsightLineItem {
  label: string;
  amount: number;
}

export interface BuiltInsightsContext {
  analysisPeriod: AnalysisPeriod;
  totals: {
    income: number;
    dailyExpenses: number;
    bills: number;
    hoa: number;
    totalExpenses: number;
    fixedExpenses: number;
    adjustableExpenses: number;
    dailyAverage: number;
    balance: number | null;
    savingsRate: number | null;
  };
  fixedItems: InsightLineItem[];
  adjustableItems: InsightLineItem[];
  incomeItems: InsightLineItem[];
  skippedUsdCount: number;
  hasCreditCardBill: boolean;
}

const FIXED_DAILY_CATEGORIES = new Set(["Servicios"]);
const CREDIT_CARD_PROVIDER_PATTERN =
  /\b(visa|master|mastercard|amex|american express|naranja|cabal)\b/i;

export function formatMonthLabelFromFilter(monthFilter: string): string {
  const [year, month] = monthFilter.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  const label = date.toLocaleString("es-AR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function resolveAnalysisPeriod(params: {
  monthFilter: string;
  analysisMonthFilter?: string;
  analysisMonthLabel?: string;
  now?: Date;
}): AnalysisPeriod {
  const now = params.now ?? new Date();

  if (params.analysisMonthFilter) {
    return {
      monthFilter: params.analysisMonthFilter,
      monthLabel:
        params.analysisMonthLabel ??
        formatMonthLabelFromFilter(params.analysisMonthFilter),
      usesCurrentMonthFallback: params.monthFilter === "all",
    };
  }

  if (params.monthFilter && params.monthFilter !== "all") {
    return {
      monthFilter: params.monthFilter,
      monthLabel:
        params.analysisMonthLabel ?? formatMonthLabelFromFilter(params.monthFilter),
      usesCurrentMonthFallback: false,
    };
  }

  const currentMonthFilter = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  return {
    monthFilter: currentMonthFilter,
    monthLabel:
      params.analysisMonthLabel ?? formatMonthLabelFromFilter(currentMonthFilter),
    usesCurrentMonthFallback: true,
  };
}

export function formatArs(amount: number): string {
  return `$${Math.round(amount).toLocaleString("es-AR")}`;
}

export function getMonthFilterForDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function toArsExpenseAmount(entry: InsightExpenseEntry): number | null {
  if (entry.amount <= 0) {
    return null;
  }

  if (entry.currency === "USD") {
    return typeof entry.arsRate === "number" && entry.arsRate > 0
      ? entry.amount * entry.arsRate
      : null;
  }

  return entry.amount;
}

export function filterBillsByMonth(
  bills: InsightBill[],
  monthFilter: string
): InsightBill[] {
  return bills.filter((bill) => {
    const rawDate = bill.dueDate ?? bill.issueDate ?? bill.periodStart ?? "";
    return getMonthFilterForDate(rawDate) === monthFilter;
  });
}

export function buildInsightsContext(params: {
  entries: InsightExpenseEntry[];
  incomeEntries: InsightIncomeEntry[];
  bills: InsightBill[];
  hoaSummaries: InsightHoaSummary[];
  monthFilter: string;
  analysisMonthFilter?: string;
  analysisMonthLabel?: string;
  now?: Date;
}): BuiltInsightsContext {
  const analysisPeriod = resolveAnalysisPeriod({
    monthFilter: params.monthFilter,
    analysisMonthFilter: params.analysisMonthFilter,
    analysisMonthLabel: params.analysisMonthLabel,
    now: params.now,
  });

  const dailyCategoryTotals: Record<string, number> = {};
  let skippedUsdCount = 0;

  for (const entry of params.entries) {
    const month = getMonthFilterForDate(entry.date);
    if (month !== analysisPeriod.monthFilter) {
      continue;
    }

    const arsAmount = toArsExpenseAmount(entry);
    if (arsAmount == null) {
      if (entry.amount > 0 && entry.currency === "USD") {
        skippedUsdCount += 1;
      }
      continue;
    }

    dailyCategoryTotals[entry.category] =
      (dailyCategoryTotals[entry.category] ?? 0) + arsAmount;
  }

  const fixedDailyItems: InsightLineItem[] = [];
  const adjustableItems: InsightLineItem[] = [];

  for (const [category, amount] of Object.entries(dailyCategoryTotals)) {
    const item = { label: category, amount };
    if (FIXED_DAILY_CATEGORIES.has(category)) {
      fixedDailyItems.push(item);
    } else {
      adjustableItems.push(item);
    }
  }

  const filteredBills = filterBillsByMonth(params.bills, analysisPeriod.monthFilter)
    .filter((bill) => bill.category !== "hoa" && bill.totalAmount > 0)
    .map((bill) => ({
      label: bill.providerName,
      amount: bill.totalAmount,
    }));

  const filteredHoa = params.hoaSummaries
    .filter((summary) => summary.periodKey === analysisPeriod.monthFilter)
    .map((summary) => ({
      label: `Expensas (${summary.periodLabel ?? analysisPeriod.monthLabel})`,
      amount: summary.totalToPayUnit ?? 0,
    }))
    .filter((item) => item.amount > 0);

  const incomeItems = params.incomeEntries
    .filter(
      (entry) => getMonthFilterForDate(entry.date) === analysisPeriod.monthFilter
    )
    .filter((entry) => entry.amount > 0)
    .map((entry) => ({
      label: `${entry.name} (${entry.source})`,
      amount: entry.amount,
    }));

  const dailyExpenses = Object.values(dailyCategoryTotals).reduce(
    (sum, amount) => sum + amount,
    0
  );
  const billsTotal = filteredBills.reduce((sum, item) => sum + item.amount, 0);
  const hoaTotal = filteredHoa.reduce((sum, item) => sum + item.amount, 0);
  const incomeTotal = incomeItems.reduce((sum, item) => sum + item.amount, 0);

  const fixedItems = [...filteredBills, ...filteredHoa, ...fixedDailyItems].sort(
    (a, b) => b.amount - a.amount
  );
  const sortedAdjustableItems = adjustableItems.sort((a, b) => b.amount - a.amount);

  const fixedTotal = fixedItems.reduce((sum, item) => sum + item.amount, 0);
  const adjustableTotal = sortedAdjustableItems.reduce(
    (sum, item) => sum + item.amount,
    0
  );
  const totalExpenses = dailyExpenses + billsTotal + hoaTotal;
  const [year, month] = analysisPeriod.monthFilter.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyAverage = daysInMonth > 0 ? dailyExpenses / daysInMonth : 0;
  const balance = incomeItems.length > 0 ? incomeTotal - totalExpenses : null;
  const savingsRate =
    incomeItems.length > 0 && incomeTotal > 0 && balance != null
      ? Math.round((balance / incomeTotal) * 100)
      : null;

  return {
    analysisPeriod,
    totals: {
      income: incomeTotal,
      dailyExpenses,
      bills: billsTotal,
      hoa: hoaTotal,
      totalExpenses,
      fixedExpenses: fixedTotal,
      adjustableExpenses: adjustableTotal,
      dailyAverage,
      balance,
      savingsRate,
    },
    fixedItems,
    adjustableItems: sortedAdjustableItems,
    incomeItems,
    skippedUsdCount,
    hasCreditCardBill: filteredBills.some((bill) =>
      CREDIT_CARD_PROVIDER_PATTERN.test(bill.label)
    ),
  };
}

export interface InitialInsightsModelOutput {
  summary: string;
  fixedObservation: string;
  adjustableObservation: string;
  actions: [string, string, string];
  caveat: string | null;
}

export function formatInitialInsightsResponse(
  context: BuiltInsightsContext,
  modelOutput: InitialInsightsModelOutput
): string {
  const summaryLines = [
    modelOutput.summary.trim(),
    `Ingresos: ${formatArs(context.totals.income)}.`,
    `Gasto total real: ${formatArs(context.totals.totalExpenses)}.`,
  ];

  if (context.totals.balance != null && context.totals.savingsRate != null) {
    summaryLines.push(
      `Balance del período: ${formatArs(context.totals.balance)} (${context.totals.savingsRate}% de ahorro).`
    );
  }

  const fixedLines =
    context.fixedItems.length > 0
      ? context.fixedItems.map((item) => `- ${item.label}: ${formatArs(item.amount)}`)
      : ["- No hay gastos fijos registrados en este período."];

  const adjustableLines =
    context.adjustableItems.length > 0
      ? context.adjustableItems.map(
          (item) => `- ${item.label}: ${formatArs(item.amount)}`
        )
      : ["- No hay gastos ajustables registrados en este período."];

  const caveatLines: string[] = [];
  if (context.skippedUsdCount > 0) {
    caveatLines.push(
      `Quedaron ${context.skippedUsdCount} gasto(s) en USD fuera de los totales porque no tenían cotización en ARS.`
    );
  }
  if (modelOutput.caveat) {
    caveatLines.push(modelOutput.caveat.trim());
  }

  return [
    "Resumen",
    summaryLines.join(" "),
    "",
    "Gastos fijos",
    ...fixedLines,
    modelOutput.fixedObservation.trim(),
    "",
    "Gastos ajustables",
    ...adjustableLines,
    modelOutput.adjustableObservation.trim(),
    "",
    "3 acciones concretas",
    `1. ${modelOutput.actions[0].trim()}`,
    `2. ${modelOutput.actions[1].trim()}`,
    `3. ${modelOutput.actions[2].trim()}`,
    ...(caveatLines.length > 0 ? ["", "Aclaraciones", ...caveatLines] : []),
  ].join("\n");
}
