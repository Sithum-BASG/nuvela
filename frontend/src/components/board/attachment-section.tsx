"use client";

import { useState } from "react";

import { AttachmentList } from "./attachment-list";
import { AttachmentUploader } from "./attachment-uploader";

type Props = {
  taskId: string;
  meId: string;
  canModerate: boolean;
  showTitle?: boolean;
};

export function AttachmentSection({
  taskId,
  meId,
  canModerate,
  showTitle = true,
}: Props) {
  const [version, setVersion] = useState(0);

  function handleUploaded() {
    setVersion((v) => v + 1);
  }

  return (
    <div className="flex flex-col gap-2.5">
      {showTitle && (
        <h3 className="font-display text-base font-semibold text-foreground">
          Attachments
        </h3>
      )}
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
