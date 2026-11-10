import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface ThemeStore {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
}

function resolve(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, _get) => ({
      theme: "dark",
      resolvedTheme: "dark",
      setTheme: (theme) => {
        const resolvedTheme = resolve(theme);
        set({ theme, resolvedTheme });
        if (resolvedTheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      },
    }),
    { name: "mb-theme" }
  )
);

/** Call once on app mount to apply saved theme. */
export function initTheme() {
  const { theme, setTheme } = useThemeStore.getState();
  setTheme(theme);

  // React to OS change when "system"
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => {
    if (useThemeStore.getState().theme === "system") {
      useThemeStore.getState().setTheme("system");
    }
  });
}
