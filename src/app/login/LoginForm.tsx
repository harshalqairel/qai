"use client";

import { useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isCloudModeEnabled } from "@/lib/supabase/config";

function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export default function LoginForm({ nextPath }: { nextPath: string | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isCloudModeEnabled();

  async function signInWithGoogle() {
    setPending(true);
    setError(null);

    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", safeNextPath(nextPath));
      const { error: authError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl.toString() },
      });
      if (authError) throw authError;
    } catch {
      setError("Google sign-in could not be started. Please try again.");
      setPending(false);
    }
  }

  if (!configured) {
    return (
      <div className="mt-7 space-y-3">
        <p className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          Cloud sign-in is not configured in this environment yet.
        </p>
        <Link href="/dashboard" className={buttonVariants({ className: "w-full" })}>
          Continue with local data
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-7">
      <Button className="w-full" onClick={signInWithGoogle} disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Connecting…
          </>
        ) : (
          "Continue with Google"
        )}
      </Button>
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        By continuing, you acknowledge Qai&apos;s Terms and Privacy Policy.
      </p>
    </div>
  );
}
