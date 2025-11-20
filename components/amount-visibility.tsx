"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AmountVisibilityContextValue = {
  showAmounts: boolean
  toggle: () => void
}

const AmountVisibilityContext = createContext<AmountVisibilityContextValue | null>(null)
const STORAGE_KEY = "bills-dashboard-show-amounts"

export function AmountVisibilityProvider({ children }: { children: ReactNode }) {
  const [showAmounts, setShowAmounts] = useState(true)

  // Restore preference once on mount
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null
    if (stored === "hidden") {
      setShowAmounts(false)
    }
  }, [])

  // Persist preference
  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, showAmounts ? "visible" : "hidden")
  }, [showAmounts])

  const value = useMemo(
    () => ({
      showAmounts,
      toggle: () => setShowAmounts((current) => !current),
    }),
    [showAmounts],
  )

  return <AmountVisibilityContext.Provider value={value}>{children}</AmountVisibilityContext.Provider>
}

export function useAmountVisibility() {
  const context = useContext(AmountVisibilityContext)
  if (!context) {
    throw new Error("useAmountVisibility must be used within AmountVisibilityProvider")
  }
  return context
}

export function AmountVisibilityToggle({ className }: { className?: string }) {
  const { showAmounts, toggle } = useAmountVisibility()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-pressed={!showAmounts}
      title={showAmounts ? "Hide amounts" : "Show amounts"}
      onClick={toggle}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center text-slate-300 hover:text-white hover:bg-slate-900",
        className,
      )}
    >
      {showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  )
}
