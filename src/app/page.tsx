import type { Metadata } from "next";
import { redirect } from "next/navigation";

import LandingExperience from "@/components/marketing/LandingExperience";
import ValidationAccess from "@/components/validation/ValidationAccess";
import { isValidationModeEnabled } from "@/lib/supabase/config";
import { requireValidationSession } from "@/lib/validation/session";

export const metadata: Metadata = {
  title: "Qai — From booking to payment, everything stays connected",
  description: "Run bookings, clients, schedules, payments, invoices, and reports in one workspace. Create a Qai Space where clients can discover your business and request a booking.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Qai — From booking to payment, everything stays connected",
    description: "A connected workspace for independent service businesses, from the first request to the final report.",
    type: "website",
    url: "/",
  },
};

export default async function Home({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  if (isValidationModeEnabled()) {
    let activeSession = false;
    try {
      await requireValidationSession();
      activeSession = true;
    } catch {
      // Show access for absent, expired, disabled, or revoked sessions.
    }
    if (activeSession) redirect("/dashboard");
    const { invite } = await searchParams;
    return <ValidationAccess invalidInvite={invite === "invalid"} />;
  }

  return <LandingExperience />;
}
