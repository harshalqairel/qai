import Link from "next/link";
import { QaiLogo } from "@/components/brand/QaiLogo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6 lg:min-h-screen">
      <section className="max-w-md text-center">
        <QaiLogo size="lg" />
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-3 text-muted-foreground">This page does not exist or may have moved.</p>
        <Link href="/dashboard" className={buttonVariants({ className: "mt-6" })}>Go to Dashboard</Link>
      </section>
    </main>
  );
}
