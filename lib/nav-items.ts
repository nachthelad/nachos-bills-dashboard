import {
  LayoutDashboard,
  Receipt,
  Wallet,
  ShoppingCart,
  Building2,
} from "lucide-react";

export const navItems = [
  { title: "Documentos", url: "/documents", icon: Receipt },
  { title: "Ingresos", url: "/income", icon: Wallet },
  { title: "Panel", url: "/dashboard", icon: LayoutDashboard },
  { title: "Gastos", url: "/expenses", icon: ShoppingCart },
  { title: "Expensas", url: "/hoa", icon: Building2 },
] as const;
