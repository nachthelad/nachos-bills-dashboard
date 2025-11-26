import type React from "react";
import { redirect } from "next/navigation";

import { ProtectedRoute } from "@/components/protected-route";
import { AppSidebar } from "@/components/app-sidebar";
import { AmountVisibilityProvider } from "@/components/amount-visibility";
import { verifyAuthFromCookies } from "@/lib/server/require-auth";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

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
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-4 py-3 lg:hidden">
            <SidebarTrigger />
          </div>
          <main className="flex-1 p-6">
            <ProtectedRoute>{children}</ProtectedRoute>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AmountVisibilityProvider>
  );
}
