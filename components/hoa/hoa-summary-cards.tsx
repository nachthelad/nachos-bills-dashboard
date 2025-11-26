"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowUpRight, PlusCircle } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface HoaSummaryCardsProps {
  chartData: { periodLabel: string; total: number }[];
  alerts: any[];
  showAmounts: boolean;
}

export function HoaSummaryCards({
  chartData,
  alerts,
  showAmounts,
}: HoaSummaryCardsProps) {
  const formatCurrency = (value: number) => {
    if (!showAmounts) return "****";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-muted">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Monthly totals</CardTitle>
          <p className="text-sm text-muted-foreground">
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
                  <XAxis
                    dataKey="periodLabel"
                    stroke="#94a3b8"
                    tick={{ fontSize: 13 }}
                  />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 13 }} width={55} />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: 8,
                    }}
                    formatter={(value: number) => formatCurrency(value)}
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
                  <p className="font-medium text-amber-100">{alert.label}</p>
                  <p className="text-xs text-amber-200/80">
                    {alert.status === "new"
                      ? "New charge this period"
                      : alert.diffPercent != null
                      ? `+${alert.diffPercent.toFixed(1)}% vs previous month`
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
                    {formatCurrency(alert.currentTotal)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
