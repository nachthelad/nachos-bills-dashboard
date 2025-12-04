"use client";

/**
 * Dashboard summary:
 * - Expenses: documents collection filtered by userId, statuses parsed/needs_review, using totalAmount + due/issue dates.
 * - Income: incomeEntries collection filtered by userId for the current year to drive cards + right-hand breakdown.
 * - Cards: Total Expenses (year), Total Income (year), Net = income - expenses, This Month (expenses in current month).
 * - Expenses Breakdown: yearly totals grouped by provider category mapping (electricity/water/etc).
"use client"

/**
 * Dashboard summary:
 * - Expenses: documents collection filtered by userId, statuses parsed/needs_review, using totalAmount + due/issue dates.
 * - Income: incomeEntries collection filtered by userId for the current year to drive cards + right-hand breakdown.
 * - Cards: Total Expenses (year), Total Income (year), Net = income - expenses, This Month (expenses in current month).
 * - Expenses Breakdown: yearly totals grouped by provider category mapping (electricity/water/etc).
 * - Income Breakdown: yearly totals grouped by source; includes quick form to add income (stored in incomeEntries).
 */

import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import type { BillDocument } from "@/lib/firestore-helpers";
import { fetchIncomeEntries, type IncomeEntry } from "@/lib/income-client";
import { type CategoryValue } from "@/config/billing/categories";
import { normalizeCategory } from "@/lib/category-utils";
import { createApiClient, type DashboardSummary } from "@/lib/api-client";
import {
  AmountVisibilityToggle,
  useAmountVisibility,
} from "@/components/amount-visibility";
import {
  resolveDocDate,
  labelForCategory,
  defaultCategoryTotals,
  parseLocalDay,
} from "@/lib/billing-utils";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { DashboardCharts } from "@/components/dashboard/charts";
import {
  RecentActivity,
  type ActivityItem,
} from "@/components/dashboard/recent-activity";
import { MobileRecentActivity } from "@/components/dashboard/mobile-recent-activity";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DashboardDocument = Omit<BillDocument, "uploadedAt"> & {
  uploadedAt: Date;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expenseDocs, setExpenseDocs] = useState<DashboardDocument[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summaryFallback, setSummaryFallback] =
    useState<DashboardSummary | null>(null);
  const { showAmounts } = useAmountVisibility();

  const apiClient = useMemo(() => {
    if (!user) return null;
    return createApiClient({ getToken: () => user.getIdToken() });
  }, [user]);

  useEffect(() => {
    if (!user || !apiClient) return;
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const [docs, incomes] = await Promise.all([
          apiClient.listDocuments(),
          (async () => {
            const token = await user.getIdToken();
            return fetchIncomeEntries(token);
          })(),
        ]);
        if (!cancelled) {
          setExpenseDocs(docs);
          setIncomeEntries(incomes);
          setError(null);
        }
      } catch (err) {
        console.error("Dashboard load error", err);
        if (!cancelled) {
          setError("Failed to load dashboard data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiClient, user]);

  // Auto-refresh for pending documents
  useEffect(() => {
    const hasPendingDocs = expenseDocs.some((doc) => doc.status === "pending");
    if (!hasPendingDocs || !apiClient) return;

    const interval = setInterval(() => {
      apiClient
        .listDocuments()
        .then((docs) => {
          setExpenseDocs(docs);
        })
        .catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, [expenseDocs, apiClient]);

  useEffect(() => {
    if (!user || !apiClient) return;
    let cancelled = false;
    (async () => {
      try {
        const summary = await apiClient.fetchDashboardSummary();
        if (!cancelled && summary) {
          setSummaryFallback(summary);
        }
      } catch (err) {
        console.warn("Dashboard summary fetch failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiClient, user]);

  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    expenseDocs.forEach((doc) => {
      const date = resolveDocDate(doc);
      if (date) years.add(date.getFullYear());
    });
    incomeEntries.forEach((entry) => {
      years.add(entry.date.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [expenseDocs, incomeEntries]);

  const currentYear = selectedYear;

  const expenseMetrics = useMemo(() => {
    const docs = expenseDocs.filter((doc) =>
      ["parsed", "needs_review"].includes(doc.status)
    );
    const totals = {
      year: 0,
      month: 0,
    };
    const categoryTotals: Record<CategoryValue, number> =
      defaultCategoryTotals();

    docs.forEach((doc) => {
      const amount = doc.totalAmount ?? 0;
      if (!amount) return;
      const docDate = resolveDocDate(doc);
      if (!docDate) return;
      if (docDate.getFullYear() === currentYear) {
        totals.year += amount;
        if (docDate.getMonth() === new Date().getMonth()) {
          totals.month += amount;
        }
        const categoryKey = normalizeCategory(
          doc.providerId,
          doc.category,
          doc.provider ?? doc.providerNameDetected ?? null
        );
        categoryTotals[categoryKey] += amount;
      }
    });

    return { totals, categoryTotals };
  }, [expenseDocs, currentYear]);

  const incomeMetrics = useMemo(() => {
    const yearEntries = incomeEntries.filter(
      (entry) => entry.date.getFullYear() === currentYear
    );
    const totalIncomeYear = yearEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0
    );
    const perSource = yearEntries.reduce<Record<string, number>>(
      (acc, entry) => {
        acc[entry.source] = (acc[entry.source] ?? 0) + entry.amount;
        return acc;
      },
      {}
    );
    return { totalIncomeYear, perSource };
  }, [incomeEntries, currentYear]);

  const netAmount = incomeMetrics.totalIncomeYear - expenseMetrics.totals.year;

  useEffect(() => {
    if (!user || !apiClient) return;
    if (loading) return;
    const hasLiveData = expenseDocs.length > 0 || incomeEntries.length > 0;
    if (!hasLiveData) return;

    const payload: DashboardSummary = {
      totals: {
        totalExpensesYear: expenseMetrics.totals.year,
        totalIncomeYear: incomeMetrics.totalIncomeYear,
        netAmount,
        monthExpenses: expenseMetrics.totals.month,
      },
      categories: { ...expenseMetrics.categoryTotals },
      incomeSources: { ...incomeMetrics.perSource },
      updatedAt: new Date().toISOString(),
    };

    (async () => {
      try {
        await apiClient.saveDashboardSummary(payload);
      } catch (err) {
        console.warn("Dashboard summary save failed:", err);
      }
    })();
  }, [
    apiClient,
    user,
    loading,
    expenseDocs,
    incomeEntries,
    expenseMetrics,
    incomeMetrics,
    netAmount,
  ]);

  const fallbackTotals = summaryFallback?.totals ?? {
    totalExpensesYear: 0,
    totalIncomeYear: 0,
    netAmount: 0,
    monthExpenses: 0,
  };
  const fallbackCategories =
    summaryFallback?.categories ?? defaultCategoryTotals();

  const hasLiveExpenses = expenseDocs.length > 0;
  const hasLiveIncome = incomeEntries.length > 0;

  const displayTotals = {
    totalExpensesYear: hasLiveExpenses
      ? expenseMetrics.totals.year
      : fallbackTotals.totalExpensesYear,
    totalIncomeYear: hasLiveIncome
      ? incomeMetrics.totalIncomeYear
      : fallbackTotals.totalIncomeYear,
    netAmount:
      hasLiveExpenses || hasLiveIncome ? netAmount : fallbackTotals.netAmount,
    monthExpenses: hasLiveExpenses
      ? expenseMetrics.totals.month
      : fallbackTotals.monthExpenses,
  };

  const displayCategoryTotals = hasLiveExpenses
    ? expenseMetrics.categoryTotals
    : fallbackCategories;

  const recentActivity: ActivityItem[] = useMemo(() => {
    const expenses: ActivityItem[] = expenseDocs
      .filter((doc) =>
        ["parsed", "needs_review", "pending"].includes(doc.status)
      )
      .map((doc) => ({
        id: doc.id,
        type: "expense",
        date: doc.updatedAt || doc.uploadedAt,
        dueDate: parseLocalDay(doc.dueDate),
        amount: doc.totalAmount || 0,
        description:
          doc.providerNameDetected || doc.providerId || "Unknown Bill",
        category: labelForCategory(doc.category),
        status: doc.status as any,
      }));

    const incomes: ActivityItem[] = incomeEntries.map((entry) => ({
      id: entry.id,
      type: "income",
      date: entry.date,
      amount: entry.amount,
      description: entry.source,
      category: "Income",
    }));

    return [...expenses, ...incomes]
      .sort((a, b) => {
        // Sort by Due Date if available, otherwise fallback to Date
        const dateA = a.dueDate ? a.dueDate.getTime() : a.date.getTime();
        const dateB = b.dueDate ? b.dueDate.getTime() : b.date.getTime();
        return dateB - dateA;
      })
      .slice(0, 10);
  }, [expenseDocs, incomeEntries]);

  const monthlyMetrics = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(currentYear, i, 1);
      return {
        name: date.toLocaleString("default", { month: "short" }),
        expenses: 0,
        income: 0,
      };
    });

    expenseDocs.forEach((doc) => {
      if (!["parsed", "needs_review"].includes(doc.status)) return;
      const amount = doc.totalAmount ?? 0;
      if (!amount) return;
      const docDate = resolveDocDate(doc);
      if (!docDate || docDate.getFullYear() !== currentYear) return;
      months[docDate.getMonth()].expenses += amount;
    });

    incomeEntries.forEach((entry) => {
      if (entry.date.getFullYear() !== currentYear) return;
      months[entry.date.getMonth()].income += entry.amount;
    });

    return months;
  }, [expenseDocs, incomeEntries, currentYear]);

  if (!user) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Please sign in to view your dashboard.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <AmountVisibilityToggle />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select
            value={String(selectedYear)}
            onValueChange={(val) => setSelectedYear(Number(val))}
          >
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <p className="text-muted-foreground">
          Overview of your financial status and recent activity.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      <KpiCards
        totalExpenses={displayTotals.totalExpensesYear}
        totalIncome={displayTotals.totalIncomeYear}
        netIncome={displayTotals.netAmount}
        monthExpenses={displayTotals.monthExpenses}
        showAmounts={showAmounts}
      />

      <DashboardCharts
        categoryTotals={displayCategoryTotals}
        monthlyData={monthlyMetrics}
        showAmounts={showAmounts}
      />

      <div className="hidden md:block">
        <RecentActivity items={recentActivity} showAmounts={showAmounts} />
      </div>
      <div className="md:hidden">
        <MobileRecentActivity
          items={recentActivity}
          showAmounts={showAmounts}
        />
      </div>
    </div>
  );
}
