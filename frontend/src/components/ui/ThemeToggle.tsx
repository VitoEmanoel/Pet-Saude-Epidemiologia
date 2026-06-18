"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "painel-theme";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

function getPreferredTheme(): Theme {
  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const preferredTheme = getPreferredTheme();
    setTheme(preferredTheme);
    applyTheme(preferredTheme);
    setMounted(true);
  }, []);

  function handleThemeChange(nextTheme: Theme) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <div className="inline-flex h-10 items-center rounded border border-slate-300 bg-white p-1 shadow-sm">
      <button
        type="button"
        aria-pressed={mounted && theme === "light"}
        aria-label="Ativar tema claro"
        title="Tema claro"
        onClick={() => handleThemeChange("light")}
        className={`inline-flex h-8 w-8 items-center justify-center rounded transition ${
          mounted && theme === "light"
            ? "bg-amber-50 text-amber-700"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        }`}
      >
        <Sun size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-pressed={mounted && theme === "dark"}
        aria-label="Ativar tema escuro"
        title="Tema escuro"
        onClick={() => handleThemeChange("dark")}
        className={`inline-flex h-8 w-8 items-center justify-center rounded transition ${
          mounted && theme === "dark"
            ? "bg-slate-900 text-white"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        }`}
      >
        <Moon size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
