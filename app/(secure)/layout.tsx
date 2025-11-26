import type React from "react";
import { redirect } from "next/navigation";

import { ProtectedRoute } from "@/components/protected-route";
import { AppSidebar } from "@/components/app-sidebar";
import { AmountVisibilityProvider } from "@/components/amount-visibility";
import { verifyAuthFromCookies } from "@/lib/server/require-auth";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await verifyAuthFromCookies();
  if (!auth) {
    redirect("/auth/login");
  }

  return (
    <AmountVisibilityProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <main className="flex-1 p-6">
            <ProtectedRoute>{children}</ProtectedRoute>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AmountVisibilityProvider>
  );
}
