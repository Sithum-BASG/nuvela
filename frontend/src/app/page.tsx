import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

// Phase 0 token/theme proof — replaced by the real splash screen in Phase 3.
export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-6">
      <h1 className="font-display text-2xl font-semibold">Nuvela</h1>
      <div className="flex items-center gap-3">
        <Button>Primary</Button>
        <Button variant="outline">Secondary</Button>
        <ThemeToggle />
      </div>
    </main>
  );
}
