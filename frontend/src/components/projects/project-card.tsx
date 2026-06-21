"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Users } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectRow } from "@/lib/projects-api.types";

// Project list row — Figma "Project List Row" (node 441:986). The Figma mock
// shows a task-count and an avatar stack, but the /projects API only returns
// memberCount (no member identities, no task totals), so we bind a member count
// chip and the status badge. Swatch fill is the project's stored content color.
type Props = {
  project: ProjectRow;
  // Owning PM / Owner: show the actions menu.
  canManage: boolean;
  onArchive?: (project: ProjectRow) => void;
  onUnarchive?: (project: ProjectRow) => void;
};

export function ProjectCard({ project, canManage, onArchive, onUnarchive }: Props) {
  const router = useRouter();
  const archived = project.status === "ARCHIVED";

  return (
    <div className="group relative flex h-[68px] items-center gap-[14px] rounded-[12px] border border-border bg-card px-4 py-3 transition-colors hover:border-border/70 hover:bg-accent-tint/40 motion-reduce:transition-none">
      {/* Whole-row click target → board. Sits below the menu (which stops propagation). */}
      <Link
        href={`/projects/${project.id}`}
        className="absolute inset-0 rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={`Open ${project.name}`}
      />

      {/* Color swatch */}
      <span
        className="h-[38px] w-[10px] shrink-0 rounded-[3px]"
        style={{ backgroundColor: project.color }}
        aria-hidden
      />

      {/* Name + description */}
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="truncate text-[14px] font-medium text-foreground">{project.name}</span>
        {project.description && (
          <span className="truncate text-[12px] text-text-muted">{project.description}</span>
        )}
      </div>

      {/* Member count */}
      <div className="flex shrink-0 items-center gap-[5px] text-text-secondary">
        <Users className="size-[14px]" strokeWidth={1.75} aria-hidden />
        <span className="text-[13px]">{project.memberCount}</span>
      </div>

      {/* Status badge */}
      {archived ? (
        <span className="inline-flex h-[22px] shrink-0 items-center rounded-[6px] bg-muted px-2 text-[12px] leading-4 text-text-muted dark:bg-white/5">
          Archived
        </span>
      ) : (
        <span className="inline-flex h-[22px] shrink-0 items-center rounded-[6px] bg-success-tint px-2 text-[12px] leading-4 text-success">
          Active
        </span>
      )}

      {/* Actions (owning PM / Owner only) */}
      {canManage && (
        <div className="relative z-10 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex size-7 items-center justify-center rounded-[6px] text-text-muted opacity-0 outline-none transition-[color,background-color,opacity] hover:bg-black/5 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100 motion-reduce:transition-none dark:hover:bg-white/10"
              aria-label={`Actions for ${project.name}`}
            >
              <MoreHorizontal className="size-[18px]" strokeWidth={1.75} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}/settings`)}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {archived ? (
                <DropdownMenuItem onClick={() => onUnarchive?.(project)}>
                  Unarchive
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem variant="destructive" onClick={() => onArchive?.(project)}>
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
