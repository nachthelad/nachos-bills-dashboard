"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import type { HoaSummary } from "@/types/hoa";
import { compareHoaSummaries } from "@/lib/hoaComparison";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  LineChart as LineChartIcon,
  Loader2,
  PlusCircle,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AmountVisibilityToggle, useAmountVisibility } from "@/components/amount-visibility";

type SelectionOption = {
  key: string;
  buildingCode: string;
  unitCode: string;
  label: string;
};

const PRIMARY_UNIT_CODE = "0005";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Loading HOA data...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-10 space-y-8">
      <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">HOA</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">HOA insights</h1>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-wide text-emerald-300">
                <LineChartIcon className="w-3.5 h-3.5" />
                Comparison
              </span>
              <AmountVisibilityToggle />
            </div>
          </div>
        <p className="text-slate-400 max-w-3xl">
          Track monthly HOA fees, spot unusual increases, and highlight new charges for your unit.
        </p>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-red-300">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {unitOptions.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-400 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Unit
          </label>
          <select
            value={selectedUnitKey}
            onChange={(event) => setSelectedUnitKey(event.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
        <Card className="border-slate-800 bg-slate-900/70">
          <CardContent className="pt-12 pb-12 text-center text-slate-400">
            <LineChartIcon className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <p className="text-lg font-medium mb-2">No HOA statements yet.</p>
            <p>Upload a "Mis Expensas" PDF to activate this module.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Monthly totals</CardTitle>
              <p className="text-sm text-slate-400">
                Track how much your unit owes each period.
              </p>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="text-sm text-slate-500 py-10 text-center">
                  Not enough data to plot yet.
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="periodLabel" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid #1e293b",
                          borderRadius: 8,
                        }}
                        formatter={(value: number) =>
                          formatCurrency(value ?? 0, showAmounts)
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="#34d399"
                        strokeWidth={2}
                        dot
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {alerts.length > 0 && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-200">
                  <AlertTriangle className="w-4 h-4" />
                  Latest period alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.rubroKey}
                    className="flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-amber-100">
                        {alert.label}
                      </p>
                      <p className="text-xs text-amber-200/80">
                        {alert.status === "new"
                          ? "New charge this period"
                          : alert.diffPercent != null
                          ? `+${alert.diffPercent.toFixed(
                              1
                            )}% vs previous month`
                          : "Higher than the previous month"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {alert.status === "new" ? (
                        <PlusCircle className="w-4 h-4 text-amber-200" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-amber-200" />
                      )}
                      <span className="text-amber-100">
                        {formatCurrency(alert.currentTotal, showAmounts)}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Detalle por rubro</CardTitle>
              <p className="text-sm text-slate-400">
                Comparación entre{" "}
                {currentSummary?.periodLabel ?? "el último período"} y{" "}
                {previousSummary
                  ? previousSummary.periodLabel
                  : "sin histórico"}
                .
              </p>
            </CardHeader>
            <CardContent>
              {!currentSummary ? (
                <div className="text-sm text-slate-500 py-6 text-center">
                  No hay datos de expensas para esta unidad.
                </div>
              ) : !previousSummary ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">
                    Aún no hay otro período para comparar. Rubros del último
                    mes:
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(currentSummary.rubros ?? []).map((rubro) => (
                      <div
                        key={`${rubro.rubroNumber}-${rubro.label}`}
                        className="rounded-lg border border-slate-800/80 bg-slate-900/70 px-4 py-3"
                      >
                        <p className="text-sm text-slate-400">
                          {rubro.label ?? `Rubro ${rubro.rubroNumber}`}
                        </p>
                        <p className="text-lg font-semibold text-slate-100">
                          {formatCurrency(rubro.total, showAmounts)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Nota: se necesitan al menos dos períodos para mostrar el
                    comparativo.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-slate-400">
                        <th className="py-2 pr-4 font-normal">Rubro</th>
                        <th className="py-2 pr-4 font-normal">
                          {previousSummary.periodLabel}
                        </th>
                        <th className="py-2 pr-4 font-normal">
                          {currentSummary.periodLabel}
                        </th>
                        <th className="py-2 pr-4 font-normal">Diferencia</th>
                        <th className="py-2 pr-4 font-normal">%</th>
                        <th className="py-2 pr-4 font-normal">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.rubroDiffs.map((diff) => (
                        <tr
                          key={diff.rubroKey}
                          className="border-t border-slate-800/60"
                        >
                          <td className="py-3 pr-4">
                            <div className="font-medium text-slate-100">
                              {diff.label}
                            </div>
                            <div className="text-xs text-slate-500">
                              Rubro {diff.rubroKey.split("::")[0]}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-slate-300">
                            {formatCurrency(diff.previousTotal, showAmounts)}
                          </td>
                          <td className="py-3 pr-4 text-slate-100">
                            {formatCurrency(diff.currentTotal, showAmounts)}
                          </td>
                          <td
                            className={`py-3 pr-4 ${
                              diff.diffAmount > 0
                                ? "text-amber-400"
                                : diff.diffAmount < 0
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }`}
                          >
                            {diff.diffAmount === 0
                              ? "—"
                              : `${
                                  diff.diffAmount > 0 ? "+" : "-"
                                }${formatCurrency(Math.abs(diff.diffAmount), showAmounts)}`}
                          </td>
                          <td
                            className={`py-3 pr-4 ${
                              diff.diffPercent && diff.diffPercent > 20
                                ? "text-amber-400"
                                : diff.diffPercent && diff.diffPercent < -20
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }`}
                          >
                            {diff.diffPercent == null
                              ? "—"
                              : `${
                                  diff.diffPercent > 0 ? "+" : ""
                                }${diff.diffPercent.toFixed(1)}%`}
                          </td>
                          <td className="py-3 pr-4">
                            <span className={statusChipClass(diff.status)}>
                              {statusLabel(diff.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function formatCurrency(value: number | null | undefined, showAmounts = true) {
  if (value === null || value === undefined) return "-";
  if (!showAmounts) return "****";
  return currencyFormatter.format(value);
}

function statusChipClass(status: string) {
  switch (status) {
    case "new":
      return "inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300";
    case "removed":
      return "inline-flex rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300";
    case "increased":
      return "inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300";
    case "decreased":
      return "inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300";
    default:
      return "inline-flex rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-400";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "new":
      return "Nuevo";
    case "removed":
      return "Eliminado";
    case "increased":
      return "Aumentó";
    case "decreased":
      return "Bajó";
    default:
      return "Sin cambios";
  }
}
