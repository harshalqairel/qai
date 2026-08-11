"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  applyAppearanceTheme,
  DEFAULT_APPEARANCE_THEME,
  getAppearanceTheme,
  saveAppearanceTheme,
  type AppearanceTheme,
} from "./appearance";

type AppearanceContextValue = {
  theme: AppearanceTheme;
  setTheme: (theme: AppearanceTheme) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppearanceTheme>(DEFAULT_APPEARANCE_THEME);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const stored = getAppearanceTheme();
        setThemeState(stored);
        applyAppearanceTheme(stored);
      } catch {
        applyAppearanceTheme(DEFAULT_APPEARANCE_THEME);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  function setTheme(nextTheme: AppearanceTheme) {
    try {
      saveAppearanceTheme(nextTheme);
    } catch {
      // Apply the choice for the current session even if browser storage is unavailable.
    }
    setThemeState(nextTheme);
    applyAppearanceTheme(nextTheme);
  }

  return <AppearanceContext.Provider value={{ theme, setTheme }}>{children}</AppearanceContext.Provider>;
}

export function useAppearanceTheme(): AppearanceContextValue {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("AppearanceThemeProvider is required.");
  return value;
}
