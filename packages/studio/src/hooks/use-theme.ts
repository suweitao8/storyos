import { useState } from "react";

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "inkos:studio:theme";

/**
 * Default theme is light. Previously the theme was time-based (light during
 * 6:00–18:00, dark otherwise) with a 60s polling interval. That behaviour was
 * removed — light is now the fixed default unless the user explicitly switches.
 */
const DEFAULT_THEME: Theme = "light";

interface ThemeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getThemeStorage(): ThemeStorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredTheme(storage: Pick<ThemeStorageLike, "getItem"> | null | undefined): Theme | null {
  const storedTheme = storage?.getItem(THEME_STORAGE_KEY);
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : null;
}

export function resolveThemePreference(params: {
  readonly storedTheme: Theme | null;
}): Theme {
  return params.storedTheme ?? DEFAULT_THEME;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() =>
    resolveThemePreference({
      storedTheme: readStoredTheme(getThemeStorage()),
    }),
  );

  const setTheme = (nextTheme: Theme) => {
    const storage = getThemeStorage();
    try {
      storage?.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage failures and keep the in-memory preference for this session.
    }
    setThemeState(nextTheme);
  };

  return { theme, setTheme };
}
