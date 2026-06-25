import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";

// Organization settings is not built yet. Until it lands, this stands in for a
// 404 with a calm "coming soon" placeholder + a route back to the dashboard.
export default function OrganizationSettingsPage() {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      {/* Soft on-brand backdrop, tinted to the accent hue (not a neon glow). */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%] -z-10 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-tint/50 blur-3xl"
      />

      <div className="flex max-w-md flex-col items-center gap-6">
        {/* Concentric icon badge — depth from layered rings, not a drop shadow. */}
        <div className="relative flex size-28 items-center justify-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-500">
          <span className="absolute inset-0 rounded-full bg-accent-tint/40" aria-hidden />
          <span className="absolute inset-3 rounded-full bg-accent-tint/70" aria-hidden />
          <span className="relative flex size-16 items-center justify-center rounded-[20px] bg-accent-tint text-primary">
            <Building2 className="size-7" strokeWidth={1.75} aria-hidden />
          </span>
        </div>

        <div className="flex flex-col items-center gap-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:[animation-delay:90ms] motion-safe:[animation-fill-mode:both]">
          <span className="inline-flex h-[22px] items-center rounded-badge bg-accent-tint px-2.5 text-xs font-medium leading-4 text-accent-strong">
            Coming soon
          </span>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground text-balance">
            Organization settings
          </h1>
          <p className="text-sm leading-[22px] text-text-secondary text-pretty">
            Manage your organization profile, branding, and team-wide defaults
            from one place. We&apos;re building it now and it&apos;ll be here soon.
          </p>
        </div>

        <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:[animation-delay:180ms] motion-safe:[animation-fill-mode:both]">
          <Button size="lg" className="gap-1.5" render={<Link href="/dashboard" />}>
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
