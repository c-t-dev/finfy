"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { SegmentedControl } from "@packages/ui/components/segmented-control";
import { useMounted } from "@packages/ui/hooks/use-mounted";

type Theme = "light" | "dark" | "system";

/** Light / Dark / Auto, like the Appearance pane in System Settings. Copied from image-resizer. */
export function ThemeToggle() {
  const t = useTranslations("common");
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  // The stored theme is unknown during SSR; render "system" until mounted.
  const value = (mounted ? theme : "system") as Theme;

  const options = [
    { value: "light" as const, icon: <SunIcon />, title: t("themes.light") },
    { value: "dark" as const, icon: <MoonIcon />, title: t("themes.dark") },
    { value: "system" as const, icon: <MonitorIcon />, title: t("themes.system") },
  ];

  const changeTheme = (next: Theme) => {
    const apply = () => {
      // next-themes updates the class in an effect, too late for the view
      // transition snapshot, so apply it synchronously here as well.
      const dark = next === "dark" || (next === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      const root = document.documentElement;
      root.classList.toggle("dark", dark);
      root.classList.toggle("light", !dark);
      root.style.colorScheme = dark ? "dark" : "light";
      setTheme(next);
    };
    // Cross-fade between themes instead of an abrupt brightness jump. The
    // transition waits for a rendered frame, so fall back to applying directly
    // if the page is not painting (e.g. a throttled background window).
    let applied = false;
    const applyOnce = () => {
      if (applied) return;
      applied = true;
      apply();
    };
    if (document.startViewTransition) {
      document.startViewTransition(applyOnce);
      setTimeout(applyOnce, 250);
    } else {
      applyOnce();
    }
  };

  return (
    <SegmentedControl<Theme>
      aria-label={t("appearance")}
      size="sm"
      value={value}
      onValueChange={changeTheme}
      options={options}
    />
  );
}
