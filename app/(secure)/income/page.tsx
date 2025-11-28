"use client";

import { useAuth } from "@/lib/auth-context";
import { useCallback, useEffect, useState } from "react";
import { fetchIncomeEntries, type IncomeEntry } from "@/lib/income-client";
import {
  AmountVisibilityToggle,
  useAmountVisibility,
} from "@/components/amount-visibility";
import { AddIncomeModal } from "@/components/income/add-income-modal";
import { IncomeTable } from "@/components/income/income-table";
import { MobileIncomeList } from "@/components/income/mobile-income-list";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function IncomePage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { showAmounts } = useAmountVisibility();

  const loadEntries = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const data = await fetchIncomeEntries(token);
      setEntries(data);
    } catch (err) {
      console.error("Income page load error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const totalIncome = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyIncome = entries
    .filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, entry) => sum + entry.amount, 0);

  const formatCurrency = (amount: number) => {
    if (!showAmounts) return "••••••";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading income...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Finance
          </p>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Income</h1>
            <AmountVisibilityToggle />
          </div>
        </div>
        <p className="text-muted-foreground">
          Track and manage your income sources.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Total Income (YTD)
            </div>
            <div className="text-3xl font-bold text-emerald-500">
              {formatCurrency(totalIncome)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              This Month
            </div>
            <div className="text-3xl font-bold text-emerald-500">
              {formatCurrency(monthlyIncome)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Income Entries</h2>
          <AddIncomeModal onSuccess={loadEntries} />
        </div>
        <div className="hidden md:block">
          <IncomeTable entries={entries} showAmounts={showAmounts} />
        </div>
        <div className="md:hidden">
          <MobileIncomeList entries={entries} showAmounts={showAmounts} />
        </div>
      </div>
    </div>
  );
}
