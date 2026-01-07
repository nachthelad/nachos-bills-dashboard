import { redirect } from "next/navigation";
import { verifyAuthFromCookies } from "@/lib/server/require-auth";

export default async function RootPage() {
  const auth = await verifyAuthFromCookies();

  if (auth) {
    redirect("/dashboard");
  } else {
    redirect("/auth/login");
  }
}
