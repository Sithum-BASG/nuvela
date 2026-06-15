"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getHealth } from "@/lib/api";

// Phase 2 cross-origin proof — replaced by the real splash screen in Phase 3.
export default function Home() {
  const [health, setHealth] = useState<string>("…");
  useEffect(() => {
    getHealth()
      .then((h) => setHealth(h.status))
      .catch(() => setHealth("unreachable"));
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-6">
      <h1 className="font-display text-2xl font-semibold">Nuvela</h1>
      <div className="flex items-center gap-3">
        <Button>Primary</Button>
        <Button variant="outline">Secondary</Button>
        <ThemeToggle />
      </div>
      <p className="text-sm text-muted-foreground">backend: {health}</p>
    </main>
  );
}
