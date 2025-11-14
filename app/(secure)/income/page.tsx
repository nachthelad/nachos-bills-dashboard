"use client"

import { useAuth } from "@/lib/auth-context"
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchIncomeEntries, type IncomeEntry } from "@/lib/income-client"

const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })

type IncomeForm = {
  amount: string
  source: string
  date: string
}

export default function IncomePage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<IncomeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState<IncomeForm>({
    amount: "",
    source: "Salary",
    date: new Date().toISOString().split("T")[0],
  })
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [incomeAction, setIncomeAction] = useState<{ id: string; type: "update" | "delete" } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadEntries = useCallback(
    async (tokenOverride?: string) => {
      if (!user) return
      const token = tokenOverride ?? (await user.getIdToken())
      const data = await fetchIncomeEntries(token)
      setEntries(data)
      setEditValues(
        data.reduce<Record<string, string>>((acc, entry) => {
          acc[entry.id] = entry.amount ? entry.amount.toString() : ""
          return acc
        }, {}),
      )
    },
    [user],
  )

  useEffect(() => {
    if (!user) return
    setLoading(true)
    ;(async () => {
      try {
        await loadEntries()
        setError(null)
      } catch (err) {
        console.error("Income page load error:", err)
        setError("Failed to load incomes.")
      } finally {
        setLoading(false)
      }
    })()
  }, [user, loadEntries])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [message])

  if (!user) {
    return <div className="p-8 text-center text-slate-400">Please sign in to manage incomes.</div>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading incomes...</div>
    )
  }

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return
    const amountValue = Number.parseFloat(form.amount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Enter a valid amount.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      const response = await fetch("/api/income", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: amountValue, source: form.source, date: form.date }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to add income")
      }
      await loadEntries(token)
      setForm({
        amount: "",
        source: "Salary",
        date: new Date().toISOString().split("T")[0],
      })
      setMessage("Income entry added.")
    } catch (err) {
      console.error("Add income error:", err)
      setError("Failed to add income entry.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveIncome = async (id: string) => {
    if (!user) return
    const amountValue = Number.parseFloat(editValues[id] ?? "")
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Enter a valid amount for this entry.")
      return
    }
    setIncomeAction({ id, type: "update" })
    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/income/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: amountValue }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to update income")
      }
      await loadEntries(token)
      setMessage("Income updated.")
    } catch (err) {
      console.error("Update income error:", err)
      setError("Failed to update income entry.")
    } finally {
      setIncomeAction(null)
    }
  }

  const handleDeleteIncome = async (id: string) => {
    if (!user) return
    setIncomeAction({ id, type: "delete" })
    try {
      const token = await user.getIdToken()
      const response = await fetch(`/api/income/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to delete income")
      }
      await loadEntries(token)
      setMessage("Income deleted.")
    } catch (err) {
      console.error("Delete income error:", err)
      setError("Failed to delete income entry.")
    } finally {
      setIncomeAction(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-slate-400">Income</p>
        <h1 className="text-3xl font-bold">Manage your salaries</h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Add or update your income entries. Changes here are reflected on the dashboard breakdown.
        </p>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        {message && <p className="text-sm text-emerald-400 mt-1">{message}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle>Add income entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Amount"
                  className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <input
                  type="text"
                  value={form.source}
                  onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}
                  placeholder="Source"
                  className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <input
                type="date"
                value={form.date}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 transition disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Add income"}
              </button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle>Existing incomes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {entries.length === 0 ? (
              <p className="text-sm text-slate-400">No entries yet. Add your first income above.</p>
            ) : (
              entries.map((entry) => {
                const isUpdating = incomeAction?.id === entry.id && incomeAction?.type === "update"
                const isDeleting = incomeAction?.id === entry.id && incomeAction?.type === "delete"
                return (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-100">{entry.source}</p>
                      <p className="text-xs text-slate-500">{formatDisplayDate(entry.date)}</p>
                      <p className="text-xs text-slate-500">{currencyFormatter.format(entry.amount || 0)}</p>
                    </div>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editValues[entry.id] ?? ""}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                        className="rounded-md border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveIncome(entry.id)}
                          disabled={isUpdating || isDeleting}
                          className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-emerald-400 disabled:opacity-60"
                        >
                          {isUpdating ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => handleDeleteIncome(entry.id)}
                          disabled={isDeleting || isUpdating}
                          className="rounded-md border border-red-500 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                        >
                          {isDeleting ? "Removing..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatDisplayDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
}
