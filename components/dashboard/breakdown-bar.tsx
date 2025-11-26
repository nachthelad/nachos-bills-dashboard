import { cn } from "@/lib/utils";

const formatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

export function BreakdownBar({
  label,
  amount,
  maxValue,
  accent = "bg-indigo-500",
  hidden = false,
}: {
  label: string;
  amount: number;
  maxValue: number;
  accent?: string;
  hidden?: boolean;
}) {
  let widthPercent = maxValue > 0 ? (amount / maxValue) * 100 : 0;
  if (amount > 0 && widthPercent < 2) {
    widthPercent = 2;
  }
  return (
    <div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        <span>{hidden ? "****" : formatter.format(amount || 0)}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", accent)}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
    </div>
  );
}
