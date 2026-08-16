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

function QaiSymbol({ className, monochrome = false }: { className?: string; monochrome?: boolean }) {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {monochrome ? (
        <g transform="translate(-6 0)">
          <path fill="currentColor" fillRule="evenodd" d="M64 9 103 31v43L84 86l30 4-22 29-28-44-20-11v-20L64 33V9Zm0 24L46 44v20l18 11 19-12V43L64 33Z" clipRule="evenodd" />
          <path d="m55 58 13-8 46 40-22 29Z" fill="currentColor" />
        </g>
      ) : (
        <g transform="translate(-6 0)">
          <path d="M64 9 102 31 83 43 64 33Z" fill="#8A4B67" />
          <path d="m102 31 1 43-20-11V43Z" fill="#75435F" />
          <path d="m103 74-19 12-20-11 19-12Z" fill="#63486F" />
          <path d="M64 75 84 86 64 98 26 76l20-12Z" fill="#536B9E" />
          <path d="M26 32 46 44v20L26 76Z" fill="#4E73A9" />
          <path d="M64 9v24L46 44 26 32Z" fill="#6B557D" />
          <path d="m55 58 13-8 46 40-22 29-13-24 12-10Z" fill="#82445F" />
          <path d="m55 58 36 27-12 10Z" fill="#70496D" />
          <path d="m79 95 13 24 22-29-23-5Z" fill="#4E6D9F" />
        </g>
      )}
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
      <QaiSymbol className={SIZES[size].mark} monochrome={tone !== "default"} />
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
      className={cn("font-bold leading-none tracking-[-0.045em]", SIZES[size].wordmark, toneClass, className)}
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

