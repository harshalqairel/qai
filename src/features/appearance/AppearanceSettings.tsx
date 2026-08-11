"use client";

import { Check } from "lucide-react";
import { APPEARANCE_THEMES } from "./appearance";
import { useAppearanceTheme } from "./AppearanceThemeProvider";

const PREVIEW_COLORS = {
  nocturne: ["#273746", "#477d7b", "#dce4e8"],
  serein: ["#356f6b", "#8aa699", "#eef1ec"],
  bloom: ["#755467", "#a67b88", "#f4ecee"],
} as const;

export default function AppearanceSettings() {
  const { theme, setTheme } = useAppearanceTheme();

  return (
    <section className="surface-card p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight">Appearance</h2>
      <p className="mt-1 text-sm text-muted-foreground">Choose the visual mood you prefer. Your business branding stays separate.</p>
      <div className="mt-6 grid gap-3 xl:grid-cols-3">
        {APPEARANCE_THEMES.map((option) => {
          const selected = option.id === theme;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              aria-pressed={selected}
              className={`min-h-32 rounded-xl border p-4 text-left transition-colors ${selected ? "border-primary ring-2 ring-ring/30" : "border-border hover:bg-muted/50"}`}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block font-semibold text-foreground">{option.name}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{option.subtitle}</span>
                </span>
                <span className={`flex size-6 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {selected && <Check className="size-4" aria-hidden="true" />}
                </span>
              </span>
              <span className="mt-5 flex gap-2" aria-hidden="true">
                {PREVIEW_COLORS[option.id].map((color) => <span key={color} className="h-7 flex-1 rounded-md" style={{ backgroundColor: color }} />)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
