"use client";

import { useAuth } from "@/lib/auth-context";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchIncomeEntries, type IncomeEntry } from "@/lib/income-client";
import {
  AmountVisibilityToggle,
  useAmountVisibility,
} from "@/components/amount-visibility";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

type IncomeForm = {
  amount: string;
  source: string;
  date: string;
};

export default function IncomePage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const formDefaults: IncomeForm = useMemo(
    () => ({
      amount: "",
      source: "Salary",
      date: new Date().toISOString().split("T")[0],
    }),
    []
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError: setFormError,
    setValue,
  } = useForm<IncomeForm>({
    defaultValues: formDefaults,
    mode: "onBlur",
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const headerError = pageError;
  const { showAmounts } = useAmountVisibility();
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const monthLabels = useMemo(
    () => [
      { value: "all", label: "All months" },
      { value: "01", label: "January" },
      { value: "02", label: "February" },
      { value: "03", label: "March" },
      { value: "04", label: "April" },
      { value: "05", label: "May" },
      { value: "06", label: "June" },
      { value: "07", label: "July" },
      { value: "08", label: "August" },
      { value: "09", label: "September" },
      { value: "10", label: "October" },
      { value: "11", label: "November" },
      { value: "12", label: "December" },
    ],
    []
  );

  const loadEntries = useCallback(
    async (tokenOverride?: string) => {
      if (!user) return;
      const token = tokenOverride ?? (await user.getIdToken());
      const data = await fetchIncomeEntries(token);
      setEntries(data);
    },
    [user]
  );

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    entries.forEach((entry) => {
      const date =
        entry.date instanceof Date ? entry.date : new Date(entry.date);
      if (!Number.isNaN(date.getTime())) {
        years.add(String(date.getFullYear()));
      }
    });
    return ["all", ...Array.from(years).sort((a, b) => Number(b) - Number(a))];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const date =
        entry.date instanceof Date ? entry.date : new Date(entry.date);
      if (Number.isNaN(date.getTime())) return false;
      const year = String(date.getFullYear());
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const yearMatch = selectedYear === "all" || selectedYear === year;
      const monthMatch = selectedMonth === "all" || selectedMonth === month;
      return yearMatch && monthMatch;
    });
  }, [entries, selectedMonth, selectedYear]);

  function handleDateInputChange(value: string) {
    const formatted = formatDateInput(value);
    setValue("date", formatted, { shouldDirty: true });
  }

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      try {
        await loadEntries();
        setPageError(null);
      } catch (err) {
        console.error("Income page load error:", err);
        setPageError("Failed to load incomes.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, loadEntries]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!user) {
    return (
      <div className="p-8 text-center text-slate-400">
        Please sign in to manage incomes.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading incomes...
      </div>
    );
  }

  const onSubmit = handleSubmit(async (data) => {
    if (!user) return;
    const amountValue = Number.parseFloat(data.amount.replace(",", "."));
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setFormError("amount", { type: "validate", message: "Enter a valid amount." });
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/income", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amountValue,
          source: data.source,
          date: data.date,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to add income");
      }
      await loadEntries(token);
      reset(formDefaults);
      setMessage("Income entry added.");
    } catch (err) {
      console.error("Add income error:", err);
      setFormError("amount", { type: "server", message: "Failed to add income entry." });
    }
  });

  const handleDeleteIncome = async (id: string) => {
    if (!user) return;
    setDeletingId(id);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/income/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete income");
      }
      await loadEntries(token);
      setMessage("Income deleted.");
    } catch (err) {
      console.error("Delete income error:", err);
      setPageError("Failed to delete income entry.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-8">
      <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-400">
              Income
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Manage your salaries</h1>
              <AmountVisibilityToggle />
            </div>
          </div>
        <div className="text-slate-400 max-w-2xl">
          <p>Add or update your income entries. Changes here are reflected on the dashboard breakdown.</p>
          {headerError && <p className="text-sm text-red-400 mt-2">{headerError}</p>}
          {message && <p className="text-sm text-emerald-400 mt-1">{message}</p>}
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader>
          <CardTitle>Add income entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-2">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  {...register("amount", { required: "Amount is required." })}
                  placeholder="Amount"
                  className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {errors.amount && (
                  <p className="text-xs text-red-400">{errors.amount.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  {...register("source", { required: "Source is required." })}
                  placeholder="Source"
                  className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {errors.source && (
                  <p className="text-xs text-red-400">{errors.source.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  {...register("date", {
                    required: "Date is required.",
                    onChange: (event) => handleDateInputChange(event.target.value),
                  })}
                  placeholder="YYYY-MM-DD"
                  className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {errors.date && (
                  <p className="text-xs text-red-400">{errors.date.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full self-start rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 transition disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : "Add income"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader>
          <CardTitle>Existing incomes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <label className="text-sm text-slate-400">Filter by:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year === "all" ? "All years" : year}
                </option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {monthLabels.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          {filteredEntries.length === 0 ? (
            <p className="text-sm text-slate-400">
              No entries match this filter.
            </p>
          ) : (
            filteredEntries.map((entry) => {
              const isDeleting = deletingId === entry.id;
              return (
                <div
                  key={entry.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-100">{entry.source}</p>
                    <p className="text-xs text-slate-500">
                      {formatDisplayDate(entry.date)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {showAmounts
                        ? currencyFormatter.format(entry.amount || 0)
                        : "****"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <button
                      onClick={() => handleDeleteIncome(entry.id)}
                      disabled={isDeleting}
                      className="rounded-md border border-red-500 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                    >
                      {isDeleting ? "Removing..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDisplayDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  let formatted = year;
  if (month) {
    formatted += `-${month}`;
  }
  if (day) {
    formatted += `-${day}`;
  }
  return formatted;
}
