"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBusinessAction, type CreateBusinessState } from "./actions";

const INITIAL_STATE: CreateBusinessState = { error: null };

export default function BusinessOnboardingForm() {
  const [state, formAction, pending] = useActionState(createBusinessAction, INITIAL_STATE);

  return (
    <form action={formAction} className="mt-7 space-y-5 text-left">
      <div className="space-y-2">
        <Label htmlFor="businessName">Business name</Label>
        <Input
          id="businessName"
          name="businessName"
          maxLength={120}
          placeholder="Your studio or business name"
          autoComplete="organization"
          required
          autoFocus
        />
      </div>
      {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Creating workspace…
          </>
        ) : (
          "Create workspace"
        )}
      </Button>
    </form>
  );
}
