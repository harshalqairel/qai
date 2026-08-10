import Link from "next/link";
import { redirect } from "next/navigation";

import { QaiLogo } from "@/components/brand/QaiLogo";
import { buttonVariants } from "@/components/ui/button";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import BusinessOnboardingForm from "./BusinessOnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!isCloudModeEnabled()) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center px-4 py-10">
        <section className="surface-card w-full max-w-md p-7 text-center sm:p-9">
          <QaiLogo size="lg" />
          <h1 className="mt-7 text-2xl font-semibold tracking-tight">Cloud setup is not configured</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            You can continue using this development environment with local data.
          </p>
          <Link href="/dashboard" className={buttonVariants({ className: "mt-7 w-full" })}>
            Continue locally
          </Link>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const { data: membership } = await supabase
    .from("business_memberships")
    .select("business_id")
    .limit(1)
    .maybeSingle();
  if (membership) redirect("/dashboard");

  return (
    <main className="flex min-h-screen w-full items-center justify-center px-4 py-10">
      <section className="surface-card w-full max-w-md p-7 text-center sm:p-9">
        <QaiLogo size="lg" />
        <h1 className="mt-7 text-2xl font-semibold tracking-tight">Set up your workspace</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Start with your business name. You can complete the rest of your profile later.
        </p>
        <BusinessOnboardingForm />
      </section>
    </main>
  );
}
