import { QaiLogo } from "@/components/brand/QaiLogo";
import LoginForm from "./LoginForm";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen w-full items-center justify-center px-4 py-10">
      <section className="surface-card w-full max-w-md p-7 text-center sm:p-9">
        <QaiLogo size="lg" />
        <h1 className="mt-7 text-2xl font-semibold tracking-tight">Welcome to Qai</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Sign in to manage your business from any device.
        </p>
        <LoginForm nextPath={next ?? null} />
      </section>
    </main>
  );
}
