import {
  LayoutDashboard,
  Receipt,
  Wallet,
  ShoppingCart,
  Building2,
} from "lucide-react";

export const navItems = [
  { title: "Bills", url: "/documents", icon: Receipt },
  { title: "Income", url: "/income", icon: Wallet },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Expenses", url: "/expenses", icon: ShoppingCart },
  { title: "HOA", url: "/hoa", icon: Building2 },
] as const;
