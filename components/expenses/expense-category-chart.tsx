"use client";

import { useMemo } from "react";
import type { ExpenseEntry } from "@/lib/expenses-client";

interface ExpenseCategoryChartProps {
  entries: ExpenseEntry[];
  monthFilter: string;
  showAmounts: boolean;
}

const COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ef4444", // red
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
];

function formatMonthLabel(ym: string): string {
  if (ym === "all") return "Todos los meses";
  const [year, month] = ym.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  const label = d.toLocaleString("es-AR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function ExpenseCategoryChart({
  entries,
  monthFilter,
  showAmounts,
}: ExpenseCategoryChartProps) {
  const data = useMemo(() => {
    const filtered = entries.filter((e) => {
      if (monthFilter === "all") return true;
      const d = e.date;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === monthFilter;
    });

    const totals: Record<string, number> = {};
    filtered
      .filter((e) => e.amount > 0)
      .forEach((e) => {
        const arsAmount =
          e.currency === "USD"
            ? e.arsRate != null
              ? e.amount * e.arsRate
              : null
            : e.amount;
        if (arsAmount == null) return;
        totals[e.category] = (totals[e.category] ?? 0) + arsAmount;
      });

    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [entries, monthFilter]);

  const formatCurrency = (value: number) => {
    if (!showAmounts) return "••••••";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
        No hay datos para mostrar
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const half = Math.ceil(data.length / 2);
  const leftCol = data.slice(0, half);
  const rightCol = data.slice(half);

  function CategoryRow({ entry, index }: { entry: { name: string; value: number }; index: number }) {
    const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
    return (
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: COLORS[index % COLORS.length] }}
        />
        <span className="text-xs sm:text-sm text-foreground">{entry.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{pct}%</span>
        <span className="text-xs sm:text-sm font-medium tabular-nums shrink-0">
          {formatCurrency(entry.value)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground shrink-0">
          {formatMonthLabel(monthFilter)}
        </p>
        <div className="flex h-5 rounded-md overflow-hidden flex-1">
          {data.map((entry, index) => {
            const pct = total > 0 ? (entry.value / total) * 100 : 0;
            return (
              <div
                key={entry.name}
                title={`${entry.name}: ${Math.round(pct)}%`}
                style={{
                  width: `${pct}%`,
                  backgroundColor: COLORS[index % COLORS.length],
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="flex justify-center min-w-0 w-full">
        <div className="flex gap-0 min-w-0 w-full max-w-full">
          <div className="flex flex-col gap-1.5 pr-3 sm:pr-5 flex-1 min-w-0 items-start">
            {leftCol.map((entry, i) => (
              <CategoryRow key={entry.name} entry={entry} index={i} />
            ))}
          </div>
          {rightCol.length > 0 && (
            <>
              <div className="w-px bg-border shrink-0" />
              <div className="flex flex-col gap-1.5 pl-3 sm:pl-5 flex-1 min-w-0 items-start">
                {rightCol.map((entry, i) => (
                  <CategoryRow key={entry.name} entry={entry} index={half + i} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
