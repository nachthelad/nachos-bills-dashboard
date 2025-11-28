"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import type { HoaSummary } from "@/types/hoa";
import { compareHoaSummaries } from "@/lib/hoaComparison";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  Building2,
  LineChart as LineChartIcon,
  Loader2,
} from "lucide-react";
import {
  AmountVisibilityToggle,
  useAmountVisibility,
} from "@/components/amount-visibility";
import { HoaSummaryCards } from "@/components/hoa/hoa-summary-cards";
import { HoaTable } from "@/components/hoa/hoa-table";
import { MobileHoaList } from "@/components/hoa/mobile-hoa-list";

type SelectionOption = {
  key: string;
  buildingCode: string;
  unitCode: string;
  label: string;
};

const PRIMARY_UNIT_CODE = "0005";

export default function HoaPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<HoaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUnitKey, setSelectedUnitKey] =
    useState<string>(PRIMARY_UNIT_CODE);
  const { showAmounts } = useAmountVisibility();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/hoa-summaries", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load HOA summaries");
        }

        const payload = await response.json();
        const normalized: HoaSummary[] = (payload.summaries ?? []).map(
          (summary: any) => ({
            ...summary,
            createdAt: summary.createdAt ? new Date(summary.createdAt) : null,
            updatedAt: summary.updatedAt ? new Date(summary.updatedAt) : null,
            rubros: Array.isArray(summary.rubros) ? summary.rubros : [],
          })
        );

        setSummaries(normalized);
        setError(null);
      } catch (err) {
        console.error(err);
        setError((err as Error).message ?? "Unexpected error");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const unitOptions = useMemo<SelectionOption[]>(() => {
    const map = new Map<string, SelectionOption>();
    summaries.forEach((summary) => {
      if (!summary.unitCode) return;
      if (PRIMARY_UNIT_CODE && summary.unitCode !== PRIMARY_UNIT_CODE) return;
      const key = summary.unitCode;
      if (map.has(key)) return;
      map.set(key, {
        key,
        buildingCode: summary.buildingCode ?? "N/A",
        unitCode: summary.unitCode,
        label: `${
          summary.buildingAddress ?? summary.buildingCode ?? "Building"
        } - Unit ${summary.unitLabel ?? summary.unitCode}`,
      });
    });
    return Array.from(map.values());
  }, [summaries]);

  useEffect(() => {
    const preferredOption = unitOptions.find(
      (option) => option.unitCode === PRIMARY_UNIT_CODE
    );
    if (preferredOption && selectedUnitKey !== preferredOption.key) {
      setSelectedUnitKey(preferredOption.key);
      return;
    }
    if (!selectedUnitKey && unitOptions.length > 0) {
      setSelectedUnitKey(unitOptions[0].key);
    }
  }, [selectedUnitKey, unitOptions]);

  const filteredSummaries = useMemo(() => {
    const unitCodeFilter = selectedUnitKey || PRIMARY_UNIT_CODE || "";
    return summaries
      .filter((summary) =>
        unitCodeFilter ? summary.unitCode === unitCodeFilter : true
      )
      .sort((a, b) => (b.periodKey ?? "").localeCompare(a.periodKey ?? ""));
  }, [summaries, selectedUnitKey]);

  const chartData = useMemo(
    () =>
      [...filteredSummaries]
        .sort((a, b) => (a.periodKey ?? "").localeCompare(b.periodKey ?? ""))
        .map((summary) => ({
          periodLabel: summary.periodLabel ?? summary.periodKey,
          total: summary.totalToPayUnit ?? 0,
        })),
    [filteredSummaries]
  );

  const currentSummary = filteredSummaries[0] ?? null;
  const previousSummary = filteredSummaries[1] ?? null;

  const comparison = useMemo(
    () => compareHoaSummaries(currentSummary, previousSummary),
    [currentSummary, previousSummary]
  );

  const alerts = useMemo(
    () =>
      comparison.rubroDiffs.filter(
        (diff) =>
          diff.status === "new" ||
          (diff.status === "increased" && (diff.diffPercent ?? 0) >= 20)
      ),
    [comparison]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 mr-2 animate-spin text-muted-foreground" />
        <div className="text-muted-foreground">Loading HOA data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            HOA
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">HOA insights</h1>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-wide text-emerald-300">
              <LineChartIcon className="w-3.5 h-3.5" />
              Comparison
            </span>
            <AmountVisibilityToggle />
          </div>
        </div>
        <p className="text-muted-foreground max-w-3xl">
          Track monthly HOA fees, spot unusual increases, and highlight new
          charges for your unit.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {unitOptions.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Unit
          </label>
          <select
            value={selectedUnitKey}
            onChange={(event) => setSelectedUnitKey(event.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {unitOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {summaries.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
            <LineChartIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">No HOA statements yet.</p>
            <p>Upload a "Mis Expensas" PDF to activate this module.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <HoaSummaryCards
            chartData={chartData}
            alerts={alerts}
            showAmounts={showAmounts}
          />
          <div className="hidden md:block">
            <HoaTable
              currentSummary={currentSummary}
              previousSummary={previousSummary}
              comparison={comparison}
              showAmounts={showAmounts}
            />
          </div>
          <div className="md:hidden">
            <MobileHoaList
              currentSummary={currentSummary}
              previousSummary={previousSummary}
              comparison={comparison}
              showAmounts={showAmounts}
            />
          </div>
        </div>
      )}
    </div>
  );
}
