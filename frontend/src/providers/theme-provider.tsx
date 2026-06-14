"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// next-themes kept as shadcn's theming dependency (its sonner toast imports it).
// attribute="class" toggles `class="dark"` on <html>, which the :root/.dark
// token blocks in globals.css key off. See CLAUDE.md.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
