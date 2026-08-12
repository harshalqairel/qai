"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { QaiLogo } from "@/components/brand/QaiLogo";
import { Button } from "@/components/ui/button";
import { prepareApplicationData } from "@/components/system/prepareApplicationData";
import { PersistenceError } from "@/lib/persistence";

type StartupFailure = "migration" | "load" | null;

export default function AppStartup({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<StartupFailure>(null);

  const prepare = useCallback(async () => {
    setFailure(null);
    try {
      await prepareApplicationData();
      setReady(true);
    } catch (error) {
      setFailure(error instanceof PersistenceError && error.code === "MIGRATION_FAILURE" ? "migration" : "load");
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void prepare(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [prepare]);

  if (ready) return children;

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6 lg:min-h-screen">
      <section className="startup-reveal w-full max-w-sm text-center" aria-live="polite">
        <QaiLogo size="lg" />
        {failure ? (
          <div className="mt-7" role="alert">
            <h1 className="text-xl font-semibold text-foreground">
              {failure === "migration" ? "Could not update your data." : "Could not load your data."}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {failure === "migration" ? "Your old data is still safe." : "Your saved data was not changed."}
            </p>
            <Button className="mt-5" onClick={() => { void prepare(); }}>Try again</Button>
          </div>
        ) : (
          <div className="mt-7 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground" role="status">
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span>Getting things ready…</span>
          </div>
        )}
      </section>
    </main>
  );
}

