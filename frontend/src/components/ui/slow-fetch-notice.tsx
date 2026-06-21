import { cn } from "@/lib/utils";

/** Subtle reassurance during Render free-tier cold starts (shown under content skeletons). */
export function SlowFetchNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "text-center text-[13px] text-text-muted motion-safe:animate-pulse motion-reduce:animate-none",
        className,
      )}
      role="status"
    >
      Waking up the server…
    </p>
  );
}
