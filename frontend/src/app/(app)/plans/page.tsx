import Link from "next/link";

import { LogoLockup } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FREE_FEATURES = [
  "Up to 3 projects",
  "Core Kanban board",
  "Up to 5 team members",
] as const;

const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited projects",
  "Advanced roles & audit log",
] as const;

function PlanCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[320px] flex-col gap-4 rounded-card border border-border bg-card p-6 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default function PlansPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-8 px-6 py-16">
      <LogoLockup className="shrink-0" />

      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-[28px] font-semibold leading-[34px] text-foreground">
          Choose your plan
        </h1>
        <p className="text-sm leading-[21px] text-text-secondary">
          Start free. Upgrade when your team grows.
        </p>
      </div>

      <div className="flex w-full max-w-[664px] flex-col items-stretch justify-center gap-6 sm:flex-row sm:items-start">
        <PlanCard>
          <p className="font-display text-xl font-semibold text-foreground">Free</p>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[28px] font-semibold leading-[34px] text-foreground">
              $0
            </span>
            <span className="text-xs text-text-muted">/ forever</span>
          </div>
          <ul className="flex flex-col gap-2 text-sm leading-[21px] text-text-secondary">
            {FREE_FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <Button className="mt-auto w-full" render={<Link href="/dashboard" />}>
            Get started
          </Button>
        </PlanCard>

        <PlanCard>
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-xl font-semibold text-foreground">Pro</p>
            <span className="inline-flex h-[22px] items-center rounded-badge bg-success-tint px-2 text-xs leading-4 text-success">
              Coming soon
            </span>
          </div>
          <p className="text-sm leading-[21px] text-text-muted">Pricing announced soon</p>
          <ul className="flex flex-col gap-2 text-sm leading-[21px] text-text-secondary">
            {PRO_FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <Button variant="outline" className="mt-auto w-full" disabled>
            Coming soon
          </Button>
        </PlanCard>
      </div>
    </div>
  );
}
