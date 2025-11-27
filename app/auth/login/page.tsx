"use client";

import { useState, useEffect } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { persistAuthCookie } from "@/lib/client/auth-cookie";
import { useAuth } from "@/lib/auth-context";
import {
  FirebaseClientInitializationError,
  getFirebaseAuth,
} from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleGoogleLogin = async () => {
    setLoading(true);

    let auth;
    try {
      auth = getFirebaseAuth();
    } catch (error) {
      if (error instanceof FirebaseClientInitializationError) {
        console.error("Firebase auth is not configured:", error.message);
        setLoading(false);
        return;
      }
      throw error;
    }

    try {
      const provider = new GoogleAuthProvider();
      // Removed prompt: "select_account" to allow automatic login if only one account exists
      const credential = await signInWithPopup(auth, provider);
      const tokenResult = await credential.user.getIdTokenResult();
      persistAuthCookie(tokenResult.token, tokenResult.expirationTime);
      router.push("/dashboard");
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <Card className="w-full max-w-md bg-card border border-border">
        <CardHeader>
          <CardTitle>TOLVA</CardTitle>
          <CardDescription>
            Sign in to manage your recurring bills
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? "Signing in..." : "Sign in with Google"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
