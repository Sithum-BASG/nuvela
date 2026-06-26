"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { CalendarDays, Check, Flag, PencilLine, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AssistantActionProposal } from "@/lib/assistant-api";

type AssistantTaskGuideProps = {
  projectId: string;
  initialTitle?: string;
  onCancel: () => void;
  onProposal: (
    proposal: Extract<AssistantActionProposal, { type: "create_task" }>,
  ) => void;
};

type GuideStep = "title" | "priority" | "dueDate" | "description" | "review";
type TaskPriority = NonNullable<
  Extract<AssistantActionProposal, { type: "create_task" }>["priority"]
>;

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const DUE_DATE_OPTIONS = [
  { label: "Today", offsetDays: 0 },
  { label: "Tomorrow", offsetDays: 1 },
  { label: "Next week", offsetDays: 7 },
];

export function AssistantTaskGuide({
  projectId,
  initialTitle,
  onCancel,
  onProposal,
}: AssistantTaskGuideProps) {
  const [step, setStep] = useState<GuideStep>(
    initialTitle?.trim() ? "priority" : "title",
  );
  const [title, setTitle] = useState(initialTitle?.trim() ?? "");
  const [priority, setPriority] = useState<TaskPriority | undefined>();
  const [dueDate, setDueDate] = useState<string | undefined>();
  const [description, setDescription] = useState("");

  const canContinueTitle = title.trim().length > 0;
  const dueDateLabel = useMemo(
    () => (dueDate ? formatShortDate(dueDate) : "No due date"),
    [dueDate],
  );

  function buildProposal(): Extract<
    AssistantActionProposal,
    { type: "create_task" }
  > {
    return {
      type: "create_task",
      projectId,
      title: title.trim(),
      priority,
      dueDate,
      description: description.trim() || undefined,
    };
  }

  return (
    <section
      className="rounded-[14px] border border-border bg-background p-4 shadow-sm"
      aria-label="Guided task creation"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-primary">
            <PencilLine className="size-4" strokeWidth={1.9} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-medium text-foreground">
              Create a task
            </h3>
            <p className="mt-1 text-[13px] leading-5 text-text-muted">
              I will collect the details first, then show a review card before
              saving anything.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          aria-label="Cancel task guide"
        >
          <X className="size-3.5" strokeWidth={2} aria-hidden />
        </Button>
      </div>

      <div className="mt-4">{renderStep()}</div>
    </section>
  );

  function renderStep() {
    if (step === "title") {
      return (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (canContinueTitle) setStep("priority");
          }}
        >
          <StepHeader
            icon={<PencilLine className="size-3.5" strokeWidth={2} />}
            label="Task title"
            description="What should the task be called?"
          />
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Write the task title"
            aria-label="Task title"
            className="h-10"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!canContinueTitle}>
              Continue
            </Button>
          </div>
        </form>
      );
    }

    if (step === "priority") {
      return (
        <div className="flex flex-col gap-3">
          <StepHeader
            icon={<Flag className="size-3.5" strokeWidth={2} />}
            label="Priority"
            description="Pick a priority, or skip it."
          />
          <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
            {PRIORITY_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={priority === option.value ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => {
                  setPriority(option.value);
                  setStep("dueDate");
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep("title")}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep("dueDate")}
            >
              Skip
            </Button>
          </div>
        </div>
      );
    }

    if (step === "dueDate") {
      return (
        <div className="flex flex-col gap-3">
          <StepHeader
            icon={<CalendarDays className="size-3.5" strokeWidth={2} />}
            label="Due date"
            description="Choose a date, or leave it open."
          />
          <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
            {DUE_DATE_OPTIONS.map((option) => (
              <Button
                key={option.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => {
                  setDueDate(toIsoDate(option.offsetDays));
                  setStep("description");
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Input
            type="date"
            value={dueDate ?? ""}
            onChange={(event) => {
              setDueDate(event.target.value || undefined);
              if (event.target.value) setStep("description");
            }}
            aria-label="Custom due date"
            className="h-10"
          />
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep("priority")}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDueDate(undefined);
                setStep("description");
              }}
            >
              No due date
            </Button>
          </div>
        </div>
      );
    }

    if (step === "description") {
      return (
        <div className="flex flex-col gap-3">
          <StepHeader
            icon={<PencilLine className="size-3.5" strokeWidth={2} />}
            label="Description"
            description="Add useful context, or skip this part."
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add notes, acceptance criteria, or context"
            aria-label="Task description"
            className="min-h-24 w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-[14px] leading-5 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
          />
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep("dueDate")}
            >
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDescription("");
                  setStep("review");
                }}
              >
                Skip
              </Button>
              <Button type="button" size="sm" onClick={() => setStep("review")}>
                Review
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <StepHeader
          icon={<Check className="size-3.5" strokeWidth={2} />}
          label="Review"
          description="Confirm the draft before I prepare the save action."
        />
        <dl className="grid gap-2 rounded-[10px] border border-border bg-surface-muted/50 p-3 text-[13px]">
          <ReviewRow label="Title" value={title.trim()} />
          <ReviewRow label="Priority" value={priorityLabel(priority)} />
          <ReviewRow label="Due" value={dueDateLabel} />
          <ReviewRow
            label="Description"
            value={description.trim() || "No description"}
          />
        </dl>
        <div className="flex justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setStep("description")}
          >
            Back
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onProposal(buildProposal())}
          >
            Prepare task
          </Button>
        </div>
      </div>
    );
  }
}

function StepHeader({
  icon,
  label,
  description,
}: {
  icon: ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[8px] bg-accent-tint text-primary"
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-[12px] leading-4 text-text-muted">
          {description}
        </p>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words text-foreground">
        {value}
      </dd>
    </div>
  );
}

function priorityLabel(priority: TaskPriority | undefined): string {
  if (!priority) return "No priority";
  return priority[0] + priority.slice(1).toLowerCase();
}

function toIsoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function isCreateTaskIntent(message: string): boolean {
  return /\b(create|add|make|draft|new)\b[\s\S]{0,32}\btask\b/i.test(message);
}

export function extractInitialTaskTitle(message: string): string {
  const explicitTitle =
    message.match(/\btask\b[\s\S]*?\b(?:called|named|titled)\s+(.+)$/i)?.[1] ??
    message.match(/\b(?:called|named|titled)\s+(.+)$/i)?.[1] ??
    message.match(/\btask\s*[:\-]\s*(.+)$/i)?.[1];

  return cleanInitialTaskTitle(explicitTitle ?? "");
}

function cleanInitialTaskTitle(value: string): string {
  return value
    .trim()
    .replace(/^["']+|["'.]+$/g, "")
    .trim();
}
