"use client";

import { useState } from "react";
import { CalendarDays, MessageSquarePlus, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  assistantApi,
  type AssistantActionProposal,
} from "@/lib/assistant-api";
import { Button } from "@/components/ui/button";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { cn } from "@/lib/utils";

type AssistantActionCardProps = {
  proposal: AssistantActionProposal;
  onConfirmed: () => void;
  onDismiss?: () => void;
  className?: string;
};

const PRIORITY_LABEL: Record<NonNullable<
  Extract<AssistantActionProposal, { type: "create_task" }>["priority"]
>, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export function AssistantActionCard({
  proposal,
  onConfirmed,
  onDismiss,
  className,
}: AssistantActionCardProps) {
  const [loading, setLoading] = useState(false);

  const isCreateTask = proposal.type === "create_task";
  const Icon = isCreateTask ? Plus : MessageSquarePlus;
  const title = isCreateTask ? "Create task" : "Post comment";

  async function handleConfirm() {
    if (loading) return;

    setLoading(true);
    try {
      if (proposal.type === "create_task") {
        await assistantApi.confirmCreateTask(proposal);
        toast.success("Task created.");
      } else {
        await assistantApi.confirmPostComment(proposal);
        toast.success("Comment posted.");
      }
      onConfirmed();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The action could not be saved.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    if (loading) return;
    onDismiss?.();
  }

  return (
    <section
      className={cn("rounded-[12px] border border-border bg-card p-4", className)}
      aria-label={title}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-primary">
          <Icon className="size-4" strokeWidth={1.9} aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[14px] font-medium text-foreground">{title}</h3>
              {isCreateTask ? (
                <p className="mt-1 text-[14px] leading-5 text-foreground">
                  {proposal.title}
                </p>
              ) : (
                <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-5 text-foreground">
                  {proposal.body}
                </p>
              )}
            </div>
          </div>

          {isCreateTask && (
            <div className="mt-3 flex flex-wrap gap-2">
              {proposal.priority ? (
                <span className="inline-flex items-center gap-1.5 rounded-badge border border-border bg-background px-2 py-1 text-[12px] font-medium text-text-secondary">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                  Priority {PRIORITY_LABEL[proposal.priority]}
                </span>
              ) : null}
              {proposal.dueDate ? (
                <span className="inline-flex items-center gap-1.5 rounded-badge border border-border bg-background px-2 py-1 text-[12px] font-medium text-text-secondary">
                  <CalendarDays className="size-3.5" strokeWidth={2} aria-hidden />
                  Due {format(new Date(proposal.dueDate), "MMM d")}
                </span>
              ) : null}
              {proposal.assigneeIds?.length ? (
                <span className="inline-flex items-center gap-1.5 rounded-badge border border-border bg-background px-2 py-1 text-[12px] font-medium text-text-secondary">
                  {proposal.assigneeIds.length} assignee
                  {proposal.assigneeIds.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            {onDismiss ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                disabled={loading}
              >
                Dismiss
              </Button>
            ) : null}
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => void handleConfirm()}
              disabled={loading}
            >
              {loading ? (
                <InlineSpinner className="size-3.5" />
              ) : null}
              {isCreateTask ? "Create task" : "Post comment"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
