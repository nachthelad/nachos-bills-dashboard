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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { fetchIncomeEntries, type IncomeEntry } from "@/lib/income-client"
import { Eye, EyeOff } from "lucide-react"
import { CATEGORY_OPTIONS, type CategoryValue } from "@/config/billing/categories"
import { normalizeCategory } from "@/lib/category-utils"
type DashboardDocument = Omit<BillDocument, "uploadedAt"> & { uploadedAt: Date }

const formatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })
const categoryOrder = CATEGORY_OPTIONS.map((option) => option.value) as CategoryValue[]

type DashboardSummary = {
  totals: {
    totalExpensesYear: number
    totalIncomeYear: number
    netAmount: number
    monthExpenses: number
  }
  categories: Record<CategoryValue, number>
  incomeSources: Record<string, number>
  updatedAt?: string | null
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [expenseDocs, setExpenseDocs] = useState<DashboardDocument[]>([])
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshingDocs, setRefreshingDocs] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null)
  const [summaryFallback, setSummaryFallback] = useState<DashboardSummary | null>(null)
  const [showAmounts, setShowAmounts] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    ;(async () => {
      try {
        const token = await user.getIdToken()
        const [docs, incomes] = await Promise.all([fetchExpenses(token), fetchIncomeEntries(token)])
        setExpenseDocs(docs)
        setIncomeEntries(incomes)
        setError(null)
      } catch (err) {
        console.error("Dashboard load error", err)
        setError("Failed to load dashboard data.")
      } finally {
        setLoading(false)
      }
    })()
  }, [user])

useEffect(() => {
  if (!user) return
  ;(async () => {
    try {
      const token = await user.getIdToken()
        const summary = await fetchDashboardSummary(token)
        if (summary) {
          setSummaryFallback(summary)
        }
      } catch (err) {
        console.warn("Dashboard summary fetch failed:", err)
      }
    })()
}, [user])

  useEffect(() => {
    if (!refreshMessage) return
    const timer = setTimeout(() => setRefreshMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [refreshMessage])

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
    if (!user) return
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
        const token = await user.getIdToken()
        await fetch("/api/dashboard-summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
      } catch (err) {
        console.warn("Dashboard summary save failed:", err)
      }
    })()
  }, [user, loading, expenseDocs, incomeEntries, expenseMetrics, incomeMetrics, netAmount])

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

  const handleRefreshParsedData = async () => {
    if (!user) return
    setRefreshingDocs(true)
    setRefreshMessage(null)
    try {
      const token = await user.getIdToken()
      const docs = await fetchExpenses(token)
      const docsNeedingParse = docs.filter((doc) => doc.status !== "parsed" || !doc.totalAmount)
      for (const doc of docsNeedingParse) {
        await fetch("/api/parse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ documentId: doc.id }),
        }).catch((err) => {
          console.warn("Parse refresh failed for", doc.id, err)
        })
      }

      const updatedDocs = await fetchExpenses(token)
      setExpenseDocs(updatedDocs)
      setRefreshMessage(
        docsNeedingParse.length ? "Parsed documents refreshed." : "All documents were already up to date.",
      )
    } catch (err) {
      console.error("Refresh parse error", err)
      setError("Failed to refresh parsed data.")
    } finally {
      setRefreshingDocs(false)
    }
  }

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
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Finance overview</p>
          <h1 className="text-3xl font-bold">Expense Dashboard</h1>
          <p className="text-slate-400 mt-2">Monitor and analyze your utility expenses across all services.</p>
          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
          {refreshMessage && <p className="text-sm text-emerald-400 mt-1">{refreshMessage}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAmounts((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
            aria-pressed={!showAmounts}
            title={showAmounts ? "Hide amounts" : "Show amounts"}
          >
            {showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            onClick={handleRefreshParsedData}
            disabled={refreshingDocs}
            className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {refreshingDocs ? "Refreshing data..." : "Refresh parsed data"}
          </button>
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

function DashboardCard({
  title,
  subtitle,
  amount,
  accent = "text-slate-100",
  hidden = false,
}: {
  title: string
  subtitle: string
  amount: number
  accent?: string
  hidden?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-sm uppercase tracking-wide text-slate-400">{title}</p>
      <p className={cn("text-3xl font-semibold mt-2", accent)}>{hidden ? "••••" : formatter.format(amount || 0)}</p>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </div>
  )
}

function BreakdownBar({
  label,
  amount,
  maxValue,
  accent = "bg-indigo-500",
  hidden = false,
}: {
  label: string
  amount: number
  maxValue: number
  accent?: string
  hidden?: boolean
}) {
  let widthPercent = maxValue > 0 ? (amount / maxValue) * 100 : 0
  if (amount > 0 && widthPercent < 2) {
    widthPercent = 2
  }
  return (
    <div>
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>{label}</span>
        <span>{hidden ? "••••" : formatter.format(amount || 0)}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-800">
        <div className={cn("h-full rounded-full transition-all", accent)} style={{ width: `${widthPercent}%` }} />
      </div>
    </div>
  )
}

function resolveDocDate(doc: BillDocument): Date | null {
  const candidates: (Date | string | null | undefined)[] = [doc.dueDate, doc.issueDate, doc.periodEnd, doc.periodStart, doc.uploadedAt]
  for (const candidate of candidates) {
    const parsed = candidate instanceof Date ? candidate : candidate ? new Date(candidate) : null
    if (parsed && !Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return null
}

async function fetchExpenses(token: string): Promise<DashboardDocument[]> {
  const response = await fetch("/api/documents", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error ?? "Failed to fetch documents")
  }
  const payload = await response.json()
  return (payload.documents ?? []).map((doc: Partial<BillDocument> & { id: string }) => ({
    ...doc,
    uploadedAt: normalizeDateInput(doc.uploadedAt),
  }))
}

async function fetchDashboardSummary(token: string): Promise<DashboardSummary | null> {
  const response = await fetch("/api/dashboard-summary", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    return null
  }
  const payload = await response.json()
  return payload.summary ?? null
}

function labelForCategory(category: (typeof categoryOrder)[number]) {
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

function defaultCategoryTotals(): Record<CategoryValue, number> {
  return categoryOrder.reduce((acc, key) => {
    acc[key] = 0
    return acc
  }, {} as Record<CategoryValue, number>)
}

function formatDisplayDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
}

function normalizeDateInput(value: unknown): Date {
  if (value instanceof Date) {
    return value
  }
  if (value && typeof value === "object" && "toDate" in (value as Record<string, unknown>)) {
    try {
      return (value as { toDate: () => Date }).toDate()
    } catch {
      return new Date()
    }
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
  }
  return new Date()
}
