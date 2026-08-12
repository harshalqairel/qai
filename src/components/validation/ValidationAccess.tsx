"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { QaiLogo } from "@/components/brand/QaiLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ValidationAccess({ invalidInvite = false }: { invalidInvite?: boolean }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(invalidInvite ? "That invite is no longer valid. Ask for a new link or use your test code." : "");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/validation/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = await response.json() as { data?: { next: string }; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error);
      window.location.assign(result.data.next);
    } catch {
      setError("That test code isn't valid.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[linear-gradient(180deg,var(--background)_0%,var(--accent)_100%)] px-4 py-10">
      <section className="surface-card w-full max-w-md p-7 sm:p-9">
        <QaiLogo size="lg" />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Remote product validation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome to Qai</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Use the private invite from the Qai team, or enter your test code to continue to your temporary business workspace.</p>
        <p className="mt-3 rounded-xl bg-accent/70 p-4 text-sm leading-6 text-muted-foreground">Qai connects the records behind requests, bookings, schedules, invoices, payments, reminders, and reports—while continuing to work with channels such as Instagram, WhatsApp, and Google Calendar.</p>
        <form className="mt-7" onSubmit={submit}>
          <Label htmlFor="validation-code">Test code</Label>
          <Input id="validation-code" className="mt-2 h-12 uppercase tracking-[0.12em]" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" placeholder="ARDI-7K29" required />
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="mt-5 w-full" size="lg" disabled={busy || code.trim().length < 4}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            Continue
          </Button>
        </form>
        <p className="mt-6 text-xs leading-5 text-muted-foreground">No signup, password, installation, or payment is required for this validation round.</p>
      </section>
    </main>
  );
}
