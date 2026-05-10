"use client";

import { useEffect, useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useRouter } from "next/navigation";

import { persistAuthCookie } from "@/lib/client/auth-cookie";
import { useAuth } from "@/lib/auth-context";
import {
  FirebaseClientInitializationError,
  getFirebaseAuth,
} from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="text-center">
        <div
          role="status"
          aria-label="Comprobando sesión"
          className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"
        />
        <p className="mt-4 text-sm text-muted-foreground">
          Comprobando sesión...
        </p>
      </div>
    </div>
  );
}

export function LoginPageClient() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  if (authLoading || user) {
    return <LoginSpinner />;
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
      const credential = await signInWithPopup(auth, provider);
      const tokenResult = await credential.user.getIdTokenResult();
      persistAuthCookie(tokenResult.token, tokenResult.expirationTime);
      router.replace("/dashboard");
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
            Iniciá sesión para gestionar tus finanzas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? "Iniciando sesión..." : "Iniciar sesión con Google"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
