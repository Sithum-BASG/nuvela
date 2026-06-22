"use client";

import { LayoutGrid, List } from "lucide-react";

import { cn } from "@/lib/utils";

export type ProjectsView = "list" | "cards";

// Gap-fill: Figma shows list and card layouts but no dedicated toggle on /projects;
// icon pair matches notifications filter styling (rounded-control chips).
type Props = {
  value: ProjectsView;
  onChange: (view: ProjectsView) => void;
  className?: string;
};

const OPTIONS: { value: ProjectsView; label: string; icon: typeof List }[] = [
  { value: "list", label: "List view", icon: List },
  { value: "cards", label: "Card view", icon: LayoutGrid },
];

export function ProjectsViewToggle({ value, onChange, className }: Props) {
  return (
    <div
      className={cn("flex gap-1 rounded-control bg-muted p-1", className)}
      role="group"
      aria-label="Projects layout"
    >
      {OPTIONS.map(({ value: option, label, icon: Icon }) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          aria-label={label}
          className={cn(
            "flex size-8 items-center justify-center rounded-[6px] transition-colors motion-reduce:transition-none",
            value === option
              ? "bg-card text-foreground shadow-sm"
              : "text-text-muted hover:text-foreground",
          )}
        >
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      ))}
    </div>
  );
}
