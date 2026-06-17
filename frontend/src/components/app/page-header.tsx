import { cn } from "@/lib/utils";

// Page-level heading (Figma "Page Header", node 253:582): Sora 28 semibold title
// + Roboto 14 secondary subtitle, with an optional trailing action slot.
export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
