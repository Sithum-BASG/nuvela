"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

// Icons flip via the CSS `dark:` variant (keyed off the .dark class next-themes
// sets pre-hydration) — no mounted/useEffect state, so it's hydration-safe and
// satisfies React 19's react-hooks/set-state-in-effect rule.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="block h-4 w-4 dark:hidden" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
