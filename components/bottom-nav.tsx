"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  ShoppingCart,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Bills", url: "/documents", icon: Receipt },
  { title: "Income", url: "/income", icon: Wallet },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Expenses", url: "/expenses", icon: ShoppingCart },
  { title: "HOA", url: "/hoa", icon: Building2 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-16">
          {navItems.map((item) => {
            const isActive = pathname === item.url;
            const Icon = item.icon;
            return (
              <Link
                key={item.url}
                href={item.url}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors duration-150",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0 left-1/2 -translate-x-1/2 h-[2px] rounded-b-full transition-all duration-200",
                    isActive ? "w-6 bg-primary" : "w-0"
                  )}
                />
                <Icon
                  className="h-[18px] w-[18px] shrink-0 transition-all duration-150"
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
                <span className="text-[10px] font-medium leading-none tracking-tight">
                  {item.title}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
