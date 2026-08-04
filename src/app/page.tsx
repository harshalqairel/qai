import Container from "@/components/ui/Container";
import Link from "next/link";
import { QaiLogo } from "@/components/brand/QaiLogo";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Container>
        <div className="surface-card mx-auto max-w-xl p-8 text-center sm:p-12">
          <QaiLogo size="lg" />
          <h1 className="mt-7 text-3xl font-semibold tracking-tight text-foreground">Your business, organized.</h1>
          <p className="mt-3 text-muted-foreground">Bookings, customers, payments, and expenses in one clear workspace.</p>
          <Link href="/dashboard" className={buttonVariants({ className: "mt-7" })}>Go to Dashboard</Link>
        </div>
      </Container>
    </main>
  );
}
