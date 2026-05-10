import { redirect } from "next/navigation";

import { LoginPageClient } from "@/components/auth/login-page-client";
import { verifyAuthFromCookies } from "@/lib/server/require-auth";

export default async function LoginPage() {
  const auth = await verifyAuthFromCookies();

  if (auth) {
    redirect("/dashboard");
  }

  return <LoginPageClient />;
}
