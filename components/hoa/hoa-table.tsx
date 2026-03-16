"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown } from "lucide-react";
import type { HoaSummary } from "@/types/hoa";

interface HoaTableProps {
  currentSummary: HoaSummary | null;
  previousSummary: HoaSummary | null;
  comparison: any;
  showAmounts: boolean;
}

export function HoaTable({
  currentSummary,
  previousSummary,
  comparison,
  showAmounts,
}: HoaTableProps) {
  const [sortBy, setSortBy] = useState<"category" | "difference">("difference");
  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    if (!showAmounts) return "****";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "new":
        return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
      case "removed":
        return "border-border bg-muted text-muted-foreground";
      case "increased":
        return "border-amber-500/30 bg-amber-500/10 text-amber-300";
      case "decreased":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
      default:
        return "border-border bg-muted text-muted-foreground";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "new":
        return "New";
      case "removed":
        return "Removed";
      case "increased":
        return "Increased";
      case "decreased":
        return "Decreased";
      default:
        return "No changes";
    }
  };

  const toggleSort = () => {
    setSortBy((prev) => (prev === "category" ? "difference" : "category"));
  };

  const getSortedDiffs = (diffs: any[]) => {
    if (!diffs) return [];
    const sorted = [...diffs];
    if (sortBy === "category") {
      return sorted.sort((a, b) => {
        const aNum = parseInt(a.rubroKey.split("::")[0]);
        const bNum = parseInt(b.rubroKey.split("::")[0]);
        return aNum - bNum;
      });
    } else {
      return sorted.sort(
        (a, b) => Math.abs(b.diffAmount || 0) - Math.abs(a.diffAmount || 0)
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">
            Details by {sortBy === "category" ? "category" : "difference"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Comparison between{" "}
            {currentSummary?.periodLabel ?? "the last period"} and{" "}
            {previousSummary
              ? previousSummary.periodLabel
              : "without history"}
            .
          </p>
        </div>
        {comparison &&
          comparison.rubroDiffs &&
          comparison.rubroDiffs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSort}
              className="ml-4 gap-2"
            >
              <ArrowUpDown className="h-4 w-4" />
              Sort by {sortBy === "category" ? "Difference" : "Category"}
            </Button>
          )}
      </div>
      {!currentSummary ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          No data for this unit.
        </div>
      ) : !previousSummary ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            No other period to compare. Categories of the last month:
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {(currentSummary.rubros ?? []).map((rubro) => (
              <div
                key={`${rubro.rubroNumber}-${rubro.label}`}
                className="rounded-lg border bg-card px-4 py-3"
              >
                <p className="text-sm text-muted-foreground">
                  {rubro.label ?? `Rubro ${rubro.rubroNumber}`}
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {formatCurrency(rubro.total)}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Note: at least two periods are needed to show the comparison.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>{previousSummary.periodLabel}</TableHead>
                  <TableHead>{currentSummary.periodLabel}</TableHead>
                  <TableHead>Difference</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getSortedDiffs(comparison.rubroDiffs).map((diff: any) => (
                  <TableRow key={diff.rubroKey}>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {diff.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Category {diff.rubroKey.split("::")[0]}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCurrency(diff.previousTotal)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(diff.currentTotal)}
                    </TableCell>
                    <TableCell
                      className={
                        diff.diffAmount > 0
                          ? "text-amber-400"
                          : diff.diffAmount < 0
                          ? "text-emerald-400"
                          : "text-muted-foreground"
                      }
                    >
                      {diff.diffAmount === 0
                        ? "—"
                        : `${diff.diffAmount > 0 ? "+" : "-"}${formatCurrency(
                            Math.abs(diff.diffAmount)
                          )
                            .replace("ARS", "")
                            .trim()}`}
                    </TableCell>
                    <TableCell
                      className={
                        diff.diffPercent && diff.diffPercent > 20
                          ? "text-amber-400"
                          : diff.diffPercent && diff.diffPercent < -20
                          ? "text-emerald-400"
                          : "text-muted-foreground"
                      }
                    >
                      {diff.diffPercent == null
                        ? "—"
                        : `${
                            diff.diffPercent > 0 ? "+" : ""
                          }${diff.diffPercent.toFixed(1)}%`}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusBadgeClass(diff.status)}
                      >
                        {statusLabel(diff.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
    </div>
  );
}
