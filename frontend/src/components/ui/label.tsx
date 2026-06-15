"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

// Field label. Matches the Figma "Form Label" component: Roboto Medium 13/20,
// text-primary. Kept dependency-free (plain <label>) to mirror the lightweight
// ui/ primitives in this project.
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-1 text-[13px] leading-5 font-medium text-foreground select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
