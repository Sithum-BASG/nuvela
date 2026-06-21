"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import {
  attachmentsApi,
  ATTACHMENT_ALLOWED_MIME,
  ATTACHMENT_MAX_BYTES,
  formatFileSize,
  type AttachmentRow,
} from "@/lib/attachments-api";
import { ApiError } from "@/lib/api-client";
import { getFriendlyErrorMessage } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

type Props = {
  taskId: string;
  onUploaded: (row: AttachmentRow) => void;
};

type UploadingState = {
  fileName: string;
  sizeBytes: number;
  progress: number;
};

export function AttachmentUploader({ taskId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<UploadingState | null>(null);

  function validate(file: File): string | null {
    if (file.size > ATTACHMENT_MAX_BYTES) return "FILE_TOO_LARGE";
    if (!ATTACHMENT_ALLOWED_MIME.has(file.type)) return "UNSUPPORTED_TYPE";
    return null;
  }

  async function uploadFile(file: File) {
    const code = validate(file);
    if (code === "FILE_TOO_LARGE") {
      toast.error("File is too large. Max 10 MB.");
      return;
    }
    if (code === "UNSUPPORTED_TYPE") {
      toast.error("Unsupported file type.");
      return;
    }

    setUploading({
      fileName: file.name,
      sizeBytes: file.size,
      progress: 35,
    });

    try {
      setUploading((u) => (u ? { ...u, progress: 70 } : u));
      const row = await attachmentsApi.upload(taskId, file);
      setUploading((u) => (u ? { ...u, progress: 100 } : u));
      onUploaded(row);
      toast.success("File uploaded.");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : getFriendlyErrorMessage(undefined);
      toast.error(message);
    } finally {
      setUploading(null);
    }
  }

  function onFilesSelected(files: FileList | null) {
    const file = files?.[0];
    if (file) void uploadFile(file);
  }

  if (uploading) {
    return (
      <div className="flex flex-col gap-2.5 rounded-[12px] border border-border bg-card p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-accent-tint text-accent-strong">
            <Loader2
              className="size-[18px] animate-spin motion-reduce:animate-none"
              strokeWidth={2}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">
              {uploading.fileName}
            </p>
            <p className="text-[12px] text-text-muted">
              {formatFileSize(uploading.sizeBytes)} · Uploading…
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUploading(null)}
            className="flex size-7 items-center justify-center rounded-[6px] text-text-muted hover:bg-surface-muted"
            aria-label="Cancel upload"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${uploading.progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFilesSelected(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed px-4 py-7 transition-colors motion-reduce:transition-none",
        dragOver
          ? "border-primary bg-accent-tint/50"
          : "border-border bg-surface-muted/30 hover:border-primary/40 hover:bg-accent-tint/30",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={(e) => {
          onFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />
      <Upload className="size-6 text-text-muted" strokeWidth={1.75} />
      <p className="text-[13px] font-medium text-foreground">
        Drag files here or click to upload
      </p>
      <p className="text-[12px] text-text-muted">
        PDF, images, Office docs, zip · up to 10 MB
      </p>
    </div>
  );
}
