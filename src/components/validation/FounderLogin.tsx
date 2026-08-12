"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { QaiLogo } from "@/components/brand/QaiLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function FounderLogin() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/validation/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });
    if (response.ok) window.location.assign("/validation/founder");
    else {
      setError("That founder credential isn't valid.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center px-4 py-10">
      <section className="surface-card w-full max-w-md p-7 sm:p-9">
        <QaiLogo size="lg" />
        <h1 className="mt-8 text-2xl font-bold">Validation manager</h1>
        <p className="mt-2 text-sm text-muted-foreground">Founder access only.</p>
        <form className="mt-6" onSubmit={submit}>
          <Label htmlFor="founder-secret">Founder credential</Label>
          <Input
            id="founder-secret"
            className="mt-2"
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="mt-5 w-full" disabled={busy}>
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            Continue
          </Button>
        </form>
      </section>
    </main>
  );
}
