import { cn } from "@/lib/utils";

type LogoVariant = "full" | "symbol" | "wordmark";
type LogoTone = "default" | "light" | "monochrome";
type LogoSize = "sm" | "md" | "lg";

type QaiLogoProps = {
  variant?: LogoVariant;
  tone?: LogoTone;
  size?: LogoSize;
  decorative?: boolean;
  className?: string;
};

const SIZES: Record<LogoSize, { mark: string; wordmark: string; gap: string }> = {
  sm: { mark: "size-6", wordmark: "text-xl", gap: "gap-1.5" },
  md: { mark: "size-8", wordmark: "text-2xl", gap: "gap-2" },
  lg: { mark: "size-12", wordmark: "text-4xl", gap: "gap-3" },
};

function QaiSymbol({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="35" cy="34" r="23" stroke="currentColor" strokeWidth="7" />
      <path
        d="M43 43 59 59"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function QaiMark({
  tone = "default",
  size = "md",
  decorative = false,
  className,
}: Omit<QaiLogoProps, "variant">) {
  const toneClass = tone === "light" ? "text-white" : tone === "monochrome" ? "text-current" : "text-[var(--brand)]";
  return (
    <span
      className={cn("inline-flex shrink-0", toneClass, className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Qai"}
      aria-hidden={decorative || undefined}
    >
      <QaiSymbol className={SIZES[size].mark} />
    </span>
  );
}

export function QaiWordmark({
  tone = "default",
  size = "md",
  decorative = false,
  className,
}: Omit<QaiLogoProps, "variant">) {
  const toneClass = tone === "light" ? "text-white" : tone === "monochrome" ? "text-current" : "text-[var(--ink)]";
  return (
    <span
      className={cn("font-semibold leading-none tracking-[-0.04em]", SIZES[size].wordmark, toneClass, className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Qai"}
      aria-hidden={decorative || undefined}
    >
      Qai
    </span>
  );
}

export function QaiLogo({
  variant = "full",
  tone = "default",
  size = "md",
  decorative = false,
  className,
}: QaiLogoProps) {
  if (variant === "symbol") {
    return <QaiMark tone={tone} size={size} decorative={decorative} className={className} />;
  }
  if (variant === "wordmark") {
    return <QaiWordmark tone={tone} size={size} decorative={decorative} className={className} />;
  }

  return (
    <span
      className={cn("inline-flex items-center", SIZES[size].gap, className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Qai"}
      aria-hidden={decorative || undefined}
    >
      <QaiMark tone={tone} size={size} decorative />
      <QaiWordmark tone={tone} size={size} decorative />
    </span>
  );
}

