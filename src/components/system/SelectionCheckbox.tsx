import { cn } from "@/lib/utils";

export default function SelectionCheckbox({ checked, onChange, label, className }: { checked: boolean; onChange: (checked: boolean) => void; label: string; className?: string }) {
  return <label className={cn("flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-muted", className)}><input type="checkbox" className="size-4 accent-primary" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} /></label>;
}
