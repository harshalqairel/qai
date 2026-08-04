import { AlertCircle } from "lucide-react";
import { QaiMark } from "@/components/brand/QaiLogo";
import { Button } from "@/components/ui/button";

type DataErrorStateProps = {
  onRetry: () => void;
  title?: string;
  message?: string;
};

export default function DataErrorState({
  onRetry,
  title = "Could not load your data.",
  message = "Your saved data was not changed.",
}: DataErrorStateProps) {
  return (
    <section className="empty-state" role="alert" aria-live="assertive">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 text-[var(--status-error)]">
        <AlertCircle className="size-6" aria-hidden="true" />
      </div>
      <QaiMark size="sm" decorative className="mt-4" />
      <h2 className="empty-title mt-4 text-xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      <Button className="mt-5" onClick={onRetry}>Try again</Button>
    </section>
  );
}

