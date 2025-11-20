"use client"

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

import { useAuth } from "@/lib/auth-context"
import { useEffect, useMemo, useState } from "react"
import type { BillDocument } from "@/lib/firestore-helpers"
import Link from "next/link"
import { fetchIncomeEntries, type IncomeEntry } from "@/lib/income-client"
import { CATEGORY_OPTIONS, type CategoryValue } from "@/config/billing/categories"
import { normalizeCategory } from "@/lib/category-utils"
import { createApiClient, type DashboardSummary } from "@/lib/api-client"
import { AmountVisibilityToggle, useAmountVisibility } from "@/components/amount-visibility"
import { DashboardCard } from "@/components/dashboard/dashboard-card"
import { BreakdownBar } from "@/components/dashboard/breakdown-bar"
import { resolveDocDate, labelForCategory, defaultCategoryTotals } from "@/lib/billing-utils"
type DashboardDocument = Omit<BillDocument, "uploadedAt"> & { uploadedAt: Date }

const categoryOrder = CATEGORY_OPTIONS.map((option) => option.value) as CategoryValue[]

export default function DashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [expenseDocs, setExpenseDocs] = useState<DashboardDocument[]>([])
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [summaryFallback, setSummaryFallback] = useState<DashboardSummary | null>(null)
  const { showAmounts } = useAmountVisibility()

  const apiClient = useMemo(() => {
    if (!user) return null
    return createApiClient({ getToken: () => user.getIdToken() })
  }, [user])

  useEffect(() => {
    if (!user || !apiClient) return
    setLoading(true)
    let cancelled = false
    ;(async () => {
      try {
        const [docs, incomes] = await Promise.all([
          apiClient.listDocuments(),
          (async () => {
            const token = await user.getIdToken()
            return fetchIncomeEntries(token)
          })(),
        ])
        if (!cancelled) {
          setExpenseDocs(docs)
          setIncomeEntries(incomes)
          setError(null)
        }
      } catch (err) {
        console.error("Dashboard load error", err)
        if (!cancelled) {
          setError("Failed to load dashboard data.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiClient, user])

  useEffect(() => {
    if (!user || !apiClient) return
    let cancelled = false
    ;(async () => {
      try {
        const summary = await apiClient.fetchDashboardSummary()
        if (!cancelled && summary) {
          setSummaryFallback(summary)
        }
      } catch (err) {
        console.warn("Dashboard summary fetch failed:", err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiClient, user])

  const currentYear = new Date().getFullYear()
  const currentMonthName = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })

  const expenseMetrics = useMemo(() => {
    const docs = expenseDocs.filter((doc) => ["parsed", "needs_review"].includes(doc.status))
    const totals = {
      year: 0,
      month: 0,
    }
    const categoryTotals: Record<CategoryValue, number> = defaultCategoryTotals()

    docs.forEach((doc) => {
      const amount = doc.totalAmount ?? 0
      if (!amount) return
      const docDate = resolveDocDate(doc)
      if (!docDate) return
      if (docDate.getFullYear() === currentYear) {
        totals.year += amount
        if (docDate.getMonth() === new Date().getMonth()) {
          totals.month += amount
        }
        const categoryKey = normalizeCategory(
          doc.providerId,
          doc.category,
          doc.provider ?? doc.providerNameDetected ?? null,
        )
        categoryTotals[categoryKey] += amount
      }
    })

    return { totals, categoryTotals }
  }, [expenseDocs, currentYear])

  const incomeMetrics = useMemo(() => {
    const yearEntries = incomeEntries.filter((entry) => entry.date.getFullYear() === currentYear)
    const totalIncomeYear = yearEntries.reduce((sum, entry) => sum + entry.amount, 0)
    const perSource = yearEntries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.source] = (acc[entry.source] ?? 0) + entry.amount
      return acc
    }, {})
    return { totalIncomeYear, perSource }
  }, [incomeEntries, currentYear])

  const netAmount = incomeMetrics.totalIncomeYear - expenseMetrics.totals.year

  useEffect(() => {
    if (!user || !apiClient) return
    if (loading) return
    const hasLiveData = expenseDocs.length > 0 || incomeEntries.length > 0
    if (!hasLiveData) return

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
    }

    ;(async () => {
      try {
        await apiClient.saveDashboardSummary(payload)
      } catch (err) {
        console.warn("Dashboard summary save failed:", err)
      }
    })()
  }, [apiClient, user, loading, expenseDocs, incomeEntries, expenseMetrics, incomeMetrics, netAmount])

  const fallbackTotals = summaryFallback?.totals ?? {
    totalExpensesYear: 0,
    totalIncomeYear: 0,
    netAmount: 0,
    monthExpenses: 0,
  }
  const fallbackCategories = summaryFallback?.categories ?? defaultCategoryTotals()
  const fallbackIncomeSources = summaryFallback?.incomeSources ?? {}

  const hasLiveExpenses = expenseDocs.length > 0
  const hasLiveIncome = incomeEntries.length > 0

  const displayTotals = {
    totalExpensesYear: hasLiveExpenses ? expenseMetrics.totals.year : fallbackTotals.totalExpensesYear,
    totalIncomeYear: hasLiveIncome ? incomeMetrics.totalIncomeYear : fallbackTotals.totalIncomeYear,
    netAmount: hasLiveExpenses || hasLiveIncome ? netAmount : fallbackTotals.netAmount,
    monthExpenses: hasLiveExpenses ? expenseMetrics.totals.month : fallbackTotals.monthExpenses,
  }

  const displayCategoryTotals = hasLiveExpenses ? expenseMetrics.categoryTotals : fallbackCategories
  const displayIncomeSources = hasLiveIncome ? incomeMetrics.perSource : fallbackIncomeSources
  const categoryMax = Math.max(...Object.values(displayCategoryTotals), 0)
  const incomeMax = Math.max(...Object.values(displayIncomeSources), 0)

  if (!user) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Please sign in to view your dashboard.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 bg-slate-950 min-h-screen text-slate-100">
      <header className="flex flex-col gap-2">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-400">Finance overview</p>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Expense Dashboard</h1>
              <AmountVisibilityToggle />
            </div>
          </div>
        <div>
          <p className="text-slate-400">Monitor and analyze your utility expenses across all services.</p>
          {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DashboardCard
          title="Total Expenses"
          subtitle={`This year (${currentYear})`}
          amount={displayTotals.totalExpensesYear}
          hidden={!showAmounts}
        />
        <DashboardCard
          title="Total Income"
          subtitle={`This year (${currentYear})`}
          amount={displayTotals.totalIncomeYear}
          hidden={!showAmounts}
        />
        <DashboardCard
          title="Net Amount"
          subtitle={`This year (${currentYear})`}
          amount={displayTotals.netAmount}
          accent={displayTotals.netAmount >= 0 ? "text-emerald-400" : "text-red-400"}
          hidden={!showAmounts}
        />
        <DashboardCard
          title="This Month"
          subtitle={currentMonthName}
          amount={displayTotals.monthExpenses}
          hidden={!showAmounts}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-400">Expenses Breakdown</p>
              <h2 className="text-xl font-semibold">Total expenses by category</h2>
            </div>
            <div className="space-y-4">
              {categoryMax === 0 ? (
                <p className="text-sm text-slate-400">No expenses yet. Upload and parse some bills to see your breakdown.</p>
              ) : (
                categoryOrder.map((category) => (
                  <BreakdownBar
                    key={category}
                    label={labelForCategory(category)}
                    amount={displayCategoryTotals[category] ?? 0}
                    maxValue={categoryMax}
                    hidden={!showAmounts}
                  />
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-400">Income Breakdown</p>
              <h2 className="text-xl font-semibold">Total income by source</h2>
              <p className="text-xs text-slate-500 mt-1">
                Manage entries from the{" "}
                <Link href="/income" className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2">
                  Income page
                </Link>
                .
              </p>
            </div>

            <div className="space-y-4">
              {incomeMax === 0 ? (
                <p className="text-sm text-slate-400">
                  No income entries yet. Head to the Income page to add your salaries or side gigs.
                </p>
              ) : (
                Object.entries(displayIncomeSources)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, total]) => (
                    <BreakdownBar
                      key={source}
                      label={source}
                      amount={total}
                      maxValue={incomeMax}
                      accent="bg-emerald-400"
                      hidden={!showAmounts}
                    />
                  ))
              )}
            </div>
          </div>
      </section>
    </div>
  )
}
