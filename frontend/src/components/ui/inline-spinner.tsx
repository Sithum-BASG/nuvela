import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
      aria-hidden
    />
  );
}
