import type React from "react";

import { ProtectedRoute } from "@/components/protected-route";
import { AppSidebar } from "@/components/app-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { AmountVisibilityProvider } from "@/components/amount-visibility";
import { verifyAuthFromCookies } from "@/lib/server/require-auth";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await verifyAuthFromCookies();
  // We allow the layout to render even if auth is missing on the server,
  // so that the client-side SDK can restore the session from IndexedDB.
  // The ProtectedRoute component will handle the redirect if the user is truly not authenticated.

  return (
    <AmountVisibilityProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <main className="flex-1 p-6 pb-24 lg:pb-6">
            <ProtectedRoute>{children}</ProtectedRoute>
          </main>
        </SidebarInset>
      </SidebarProvider>
      <BottomNav />
    </AmountVisibilityProvider>
  );
}
