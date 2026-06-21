"use client";

import Link from "next/link";
import { CheckCircle2, Folder, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MemberAvatarStack } from "@/components/projects/member-avatar-stack";
import type { ProjectRow } from "@/lib/projects-api.types";

// Project grid card — Figma "Project Card" (node 925:28): folder swatch, title,
// description, member avatars, completed/total task count.
type Props = {
  project: ProjectRow;
  canManage: boolean;
  onArchive?: (project: ProjectRow) => void;
};

export function ProjectGridCard({ project, canManage, onArchive }: Props) {
  const router = useRouter();

  return (
    <div className="group relative flex min-h-[150px] flex-col gap-3 rounded-[12px] border border-border bg-card px-5 py-[18px] transition-colors hover:border-border/70 hover:bg-accent-tint/30 motion-reduce:transition-none">
      <Link
        href={`/projects/${project.id}`}
        className="absolute inset-0 rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={`Open ${project.name}`}
      />

      <div className="flex items-center gap-2.5">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-[8px]"
          style={{ backgroundColor: project.color }}
          aria-hidden
        >
          <Folder className="size-4 text-white" strokeWidth={1.75} />
        </span>
        <h2 className="min-w-0 flex-1 truncate font-display text-base font-semibold text-foreground">
          {project.name}
        </h2>
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
                <DropdownMenuItem variant="destructive" onClick={() => onArchive?.(project)}>
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {project.description ? (
        <p className="line-clamp-2 text-[13px] leading-snug text-text-secondary">
          {project.description}
        </p>
      ) : (
        <p className="text-[13px] text-text-muted">&nbsp;</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3">
        <MemberAvatarStack
          members={project.memberPreview}
          memberCount={project.memberCount}
          size="sm"
        />
        <div className="flex items-center gap-1.5 text-text-muted">
          <CheckCircle2 className="size-3.5" strokeWidth={1.75} aria-hidden />
          <span className="text-xs tabular-nums">
            {project.completedTasks}/{project.totalTasks}
          </span>
        </div>
      </div>
    </div>
  );
}
