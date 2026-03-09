import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartsProps {
  categoryTotals: Record<string, number>;
  monthlyData: { name: string; expenses: number; income: number }[];
  showAmounts: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Credit Card": "#f87171", // red
  Electricity: "#facc15", // yellow
  Gas: "#fb923c", // orange
  "Gastos Diarios": "#a78bfa", // violet
  Health: "#34d399", // green
  "Home / HOA": "#60a5fa", // blue
  "Internet / Mobile": "#38bdf8", // sky
  Water: "#2dd4bf", // teal
  Other: "#94a3b8", // slate
};

const FALLBACK_COLORS = [
  "#f87171",
  "#facc15",
  "#fb923c",
  "#a78bfa",
  "#34d399",
  "#60a5fa",
  "#38bdf8",
  "#2dd4bf",
  "#94a3b8",
];

import { getCategoryLabel } from "@/config/billing/categories";

// ... existing imports ...

export function DashboardCharts({
  categoryTotals,
  monthlyData,
  showAmounts,
}: ChartsProps) {
  const data = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name: getCategoryLabel(name), value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const formatCurrency = (value: number) => {
    if (!showAmounts) return "••••••";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    }
    return `$${value}`;
  };

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-7">
      <Card className="col-span-1 md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>Expenses vs Income over time</CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatYAxis}
                />
                <Tooltip
                  cursor={{ fill: "#1e293b" }}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#1e293b",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#f8fafc" }}
                  itemStyle={{ color: "#f8fafc" }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Bar
                  dataKey="income"
                  name="Income"
                  fill="#34d399"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expenses"
                  name="Expenses"
                  fill="#f87171"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card className="col-span-1 md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle>Expenses Breakdown</CardTitle>
          <CardDescription>Distribution by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 h-[300px]">
            <div className="flex-1 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          CATEGORY_COLORS[entry.name] ??
                          FALLBACK_COLORS[index % FALLBACK_COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#1e293b",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#f8fafc" }}
                    itemStyle={{ color: "#f8fafc" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 text-xs md:text-sm min-w-[110px] md:min-w-[130px]">
              {data.map((entry, index) => {
                const color =
                  CATEGORY_COLORS[entry.name] ??
                  FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                const total = data.reduce((s, d) => s + d.value, 0);
                const pct =
                  total > 0 ? Math.round((entry.value / total) * 100) : 0;
                return (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-muted-foreground truncate flex-1">
                      {entry.name}
                    </span>
                    <span className="text-foreground font-medium tabular-nums">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
