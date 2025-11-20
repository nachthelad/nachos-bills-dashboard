import { cn } from "@/lib/utils"

const formatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })

export function DashboardCard({
  title,
  subtitle,
  amount,
  accent = "text-slate-100",
  hidden = false,
}: {
  title: string
  subtitle: string
  amount: number
  accent?: string
  hidden?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-sm uppercase tracking-wide text-slate-400">{title}</p>
      <p className={cn("text-3xl font-semibold mt-2", accent)}>{hidden ? "****" : formatter.format(amount || 0)}</p>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </div>
  )
}
