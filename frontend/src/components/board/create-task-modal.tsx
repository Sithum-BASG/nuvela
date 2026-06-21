"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { tasksApi } from "@/lib/tasks-api";
import type { TaskRow } from "@/lib/tasks-api.types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ButtonPendingLabel } from "@/components/ui/button-pending-label";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  dueDate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: (task: TaskRow) => void;
};

export function CreateTaskModal({ open, projectId, onClose, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "MEDIUM" },
  });

  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const task = await tasksApi.tasks.create(projectId, {
        title: values.title,
        description: values.description || undefined,
        priority: values.priority,
        dueDate: values.dueDate || undefined,
      });
      toast.success("Task created.");
      reset();
      onCreated(task);
    } catch {
      toast.error("Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    reset();
    setPriority("MEDIUM");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pt-1">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              placeholder="Task title"
              autoFocus
              {...register("title")}
            />
            {errors.title && (
              <p className="text-[12px] text-danger">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-desc">Description (optional)</Label>
            <textarea
              id="task-desc"
              rows={3}
              placeholder="Add a description…"
              className="w-full resize-none rounded-[8px] border border-input bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring/50"
              {...register("description")}
            />
          </div>

          {/* Priority + Due date */}
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => {
                  const val = v as "LOW" | "MEDIUM" | "HIGH";
                  setPriority(val);
                  setValue("priority", val);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="task-due">Due date (optional)</Label>
              <Input
                id="task-due"
                type="date"
                className="h-9"
                {...register("dueDate")}
              />
            </div>
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              <ButtonPendingLabel pending={submitting} label="Create task" pendingLabel="Creating…" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
