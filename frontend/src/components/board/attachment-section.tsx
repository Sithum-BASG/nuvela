"use client";

import { useState } from "react";

import { AttachmentList } from "./attachment-list";
import { AttachmentUploader } from "./attachment-uploader";

type Props = {
  taskId: string;
  meId: string;
  canModerate: boolean;
};

export function AttachmentSection({ taskId, meId, canModerate }: Props) {
  const [version, setVersion] = useState(0);

  function handleUploaded() {
    setVersion((v) => v + 1);
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        Attachments
      </span>
      <AttachmentList
        key={version}
        taskId={taskId}
        meId={meId}
        canModerate={canModerate}
      />
      <AttachmentUploader taskId={taskId} onUploaded={handleUploaded} />
    </div>
  );
}
