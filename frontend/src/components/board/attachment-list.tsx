"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  attachmentsApi,
  formatFileSize,
  type AttachmentRow,
} from "@/lib/attachments-api";
import { cn } from "@/lib/utils";

type Props = {
  taskId: string;
  meId: string;
  canModerate: boolean;
  onChanged?: () => void;
};

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return FileSpreadsheet;
  if (mimeType === "application/pdf" || mimeType.includes("word"))
    return FileText;
  return FileType;
}

export function AttachmentList({
  taskId,
  meId,
  canModerate,
  onChanged,
}: Props) {
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    attachmentsApi
      .list(taskId)
      .then((rows) => {
        if (!cancelled) setAttachments(rows);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load attachments.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  async function handleDownload(id: string) {
    try {
      const { url } = await attachmentsApi.signedUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Failed to get download link.");
    }
  }

  async function handleDelete(id: string) {
    const previous = attachments;
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    try {
      await attachmentsApi.remove(id);
      onChanged?.();
    } catch {
      setAttachments(previous);
      toast.error("Failed to delete attachment.");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-[60px] animate-pulse rounded-[10px] bg-border motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-border bg-surface-muted/50 px-4 py-6 text-center">
        <p className="text-[14px] font-medium text-foreground">
          No attachments yet
        </p>
        <p className="text-[13px] text-text-muted">
          Upload files to share with the project team.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {attachments.map((attachment) => {
        const Icon = fileIcon(attachment.mimeType);
        const canDelete =
          attachment.uploadedBy.id === meId || canModerate;

        return (
          <div
            key={attachment.id}
            className="group flex h-[60px] items-center gap-3 rounded-[10px] border border-border bg-card py-2.5 pl-3 pr-2.5"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-accent-tint text-accent-strong">
              <Icon className="size-[18px]" strokeWidth={1.75} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">
                {attachment.fileName}
              </p>
              <p className="truncate text-[12px] text-text-muted">
                {formatFileSize(attachment.sizeBytes)} · Uploaded by{" "}
                {attachment.uploadedBy.name} ·{" "}
                {formatDistanceToNow(new Date(attachment.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleDownload(attachment.id)}
              className="flex size-9 shrink-0 items-center justify-center rounded-[8px] text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label={`Download ${attachment.fileName}`}
            >
              <Download className="size-4" strokeWidth={2} />
            </button>

            {canDelete && (
              <button
                type="button"
                onClick={() => void handleDelete(attachment.id)}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-[6px] text-text-muted opacity-0 transition-opacity",
                  "hover:bg-danger-tint hover:text-danger focus-visible:opacity-100 group-hover:opacity-100",
                  "motion-reduce:transition-none",
                )}
                aria-label={`Delete ${attachment.fileName}`}
              >
                <Trash2 className="size-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
