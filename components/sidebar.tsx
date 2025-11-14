"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { FileText, Upload, BarChart3, LogOut, Building2, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

export function Sidebar() {
  const pathname = usePathname()
  const { signOut } = useAuth()

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/hoa", label: "HOA", icon: Building2 },
    { href: "/income", label: "Income", icon: Wallet },
    { href: "/upload", label: "Upload Bill", icon: Upload },
    { href: "/documents", label: "Documents", icon: FileText },
  ]

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-900 flex flex-col min-h-screen text-slate-100">
      <div className="p-6 border-b border-slate-900">
        <h1 className="text-xl font-bold tracking-tight">Bills</h1>
        <p className="text-sm text-slate-400 mt-1">Keep your utilities in sync</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === href
                ? "bg-slate-900 text-white shadow-inner shadow-slate-900/60"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            )}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-900">
        <Button
          onClick={signOut}
          variant="ghost"
          className="w-full justify-start gap-2 text-slate-300 hover:text-white hover:bg-slate-900"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  )
}
