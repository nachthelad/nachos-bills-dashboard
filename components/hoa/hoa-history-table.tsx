"use client";

import { useMemo, useState } from "react";
import type { HoaSummary } from "@/types/hoa";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { buildRubroKey } from "@/lib/hoaComparison";

interface HoaHistoryTableProps {
  summaries: HoaSummary[];
  showAmounts: boolean;
}

const EPSILON = 0.01;

export function HoaHistoryTable({ summaries, showAmounts }: HoaHistoryTableProps) {
  const [sortBy, setSortBy] = useState<"category" | "difference">("category");

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    if (!showAmounts) return "****";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Sort oldest → newest for column order
  const orderedSummaries = useMemo(
    () => [...summaries].sort((a, b) => a.periodKey.localeCompare(b.periodKey)),
    [summaries]
  );

  const { rubroKeyOrder, rubroLabels, rubroNumbers, matrix } = useMemo(() => {
    const rubroKeyOrder: string[] = [];
    const rubroLabels = new Map<string, string>();
    const rubroNumbers = new Map<string, number | null>();
    const matrix = new Map<string, Map<string, number | null>>();

    for (const summary of orderedSummaries) {
      for (const rubro of summary.rubros ?? []) {
        const key = buildRubroKey(rubro.rubroNumber ?? null, rubro.label ?? "");
        if (!matrix.has(key)) {
          rubroKeyOrder.push(key);
          matrix.set(key, new Map());
        }
        if (!rubroLabels.has(key) && rubro.label) {
          rubroLabels.set(key, rubro.label);
        }
        if (!rubroNumbers.has(key)) {
          rubroNumbers.set(key, rubro.rubroNumber ?? null);
        }
        matrix.get(key)!.set(summary.periodKey, rubro.total ?? null);
      }
    }

    return { rubroKeyOrder, rubroLabels, rubroNumbers, matrix };
  }, [orderedSummaries]);

  const sortedRubroKeys = useMemo(() => {
    const keys = [...rubroKeyOrder];
    if (sortBy === "category") {
      return keys.sort((a, b) => {
        const aNum = rubroNumbers.get(a);
        const bNum = rubroNumbers.get(b);
        if (aNum !== null && aNum !== undefined && bNum !== null && bNum !== undefined)
          return aNum - bNum;
        if (aNum !== null && aNum !== undefined) return -1;
        if (bNum !== null && bNum !== undefined) return 1;
        return (rubroLabels.get(a) ?? a).localeCompare(rubroLabels.get(b) ?? b);
      });
    } else {
      // Sort by absolute difference between last and first available value
      return keys.sort((a, b) => {
        const rowA = matrix.get(a)!;
        const rowB = matrix.get(b)!;
        const diffA = Math.abs(overallDiff(rowA, orderedSummaries));
        const diffB = Math.abs(overallDiff(rowB, orderedSummaries));
        return diffB - diffA;
      });
    }
  }, [rubroKeyOrder, sortBy, rubroNumbers, rubroLabels, matrix, orderedSummaries]);

  if (summaries.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
        No history available yet.
      </div>
    );
  }

  const cellColor = (
    current: number | null,
    previous: number | null | undefined
  ): string => {
    if (current === null) return "text-muted-foreground italic";
    if (previous === undefined || previous === null) return "text-emerald-400";
    if (Math.abs(current - previous) <= EPSILON) return "";
    return current > previous ? "text-amber-400" : "text-emerald-400";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            Details by {sortBy === "category" ? "category" : "difference"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {orderedSummaries.length} period{orderedSummaries.length !== 1 ? "s" : ""} recorded.
          </p>
        </div>
        {rubroKeyOrder.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortBy((prev) => (prev === "category" ? "difference" : "category"))}
            className="gap-2"
          >
            <ArrowUpDown className="h-4 w-4" />
            Sort by {sortBy === "category" ? "Difference" : "Category"}
          </Button>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10 min-w-[180px]">
                Category
              </TableHead>
              {orderedSummaries.map((s) => (
                <TableHead
                  key={s.periodKey}
                  className="text-right whitespace-nowrap min-w-[110px]"
                >
                  {s.periodLabel}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRubroKeys.map((key) => {
              const label = rubroLabels.get(key) ?? key;
              const rubroNum = rubroNumbers.get(key);
              const rowMap = matrix.get(key)!;
              return (
                <TableRow key={key}>
                  <TableCell className="sticky left-0 bg-card z-10">
                    <div className="font-medium text-foreground whitespace-nowrap">
                      {label}
                    </div>
                    {rubroNum !== null && rubroNum !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        Category {rubroNum}
                      </div>
                    )}
                  </TableCell>
                  {orderedSummaries.map((s, colIdx) => {
                    const val = rowMap.get(s.periodKey) ?? null;
                    const prevSummary = colIdx > 0 ? orderedSummaries[colIdx - 1] : null;
                    const prevVal = prevSummary
                      ? (matrix.get(key)?.get(prevSummary.periodKey) ?? null)
                      : undefined;
                    return (
                      <TableCell
                        key={s.periodKey}
                        className={`text-right whitespace-nowrap ${cellColor(val, prevVal)}`}
                      >
                        {formatCurrency(val)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}

            {/* TOTAL row */}
            <TableRow className="border-t-2 font-bold">
              <TableCell className="sticky left-0 bg-card z-10 whitespace-nowrap uppercase text-xs tracking-wide text-muted-foreground">
                Total
              </TableCell>
              {orderedSummaries.map((s, colIdx) => {
                const val = s.totalToPayUnit ?? null;
                const prevVal =
                  colIdx > 0
                    ? (orderedSummaries[colIdx - 1].totalToPayUnit ?? null)
                    : undefined;
                return (
                  <TableCell
                    key={s.periodKey}
                    className={`text-right whitespace-nowrap ${cellColor(val, prevVal)}`}
                  >
                    {formatCurrency(val)}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function overallDiff(
  rowMap: Map<string, number | null>,
  orderedSummaries: HoaSummary[]
): number {
  const vals = orderedSummaries
    .map((s) => rowMap.get(s.periodKey) ?? null)
    .filter((v): v is number => v !== null);
  if (vals.length < 2) return 0;
  return vals[vals.length - 1] - vals[0];
}
