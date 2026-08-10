"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { isCloudModeEnabled } from "@/lib/supabase/config";

export default function AuthControls() {
  const [email, setEmail] = useState<string | null>(null);
  const configured = isCloudModeEnabled();

  useEffect(() => {
    if (!configured) return;

    let active = true;
    createClient().auth.getUser().then(({ data }) => {
      if (active) setEmail(data.user?.email ?? null);
    });
    return () => {
      active = false;
    };
  }, [configured]);

  if (!configured || !email) return null;

  return (
    <div className="border-t border-border pt-4">
      <p className="truncate px-2 text-xs text-muted-foreground" title={email}>{email}</p>
      <form action="/auth/sign-out" method="post" className="mt-2">
        <button
          type="submit"
          className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </div>
  );
}
