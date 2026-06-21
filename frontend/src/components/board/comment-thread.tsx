"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { commentsApi, type CommentRow } from "@/lib/comments-api";
import { avatarColor, initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { MentionInput } from "./mention-input";
import { TaskRowSkeleton } from "@/components/ui/loading-states";

type Me = { id: string; name: string };

type Props = {
  taskId: string;
  projectId: string;
  me: Me;
  canModerate: boolean;
};

function renderCommentBody(body: string, mentions: CommentRow["mentions"]) {
  if (mentions.length === 0) {
    return <span>{body}</span>;
  }

  const names = [...mentions]
    .map((m) => m.name.split(/\s+/)[0])
    .sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g",
  );

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={key++} className="font-medium text-accent-strong">
        @{match[1]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }

  return <>{parts}</>;
}

export function CommentThread({ taskId, projectId, me, canModerate }: Props) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    commentsApi
      .list(taskId)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load comments.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  async function handleCreate(payload: {
    body: string;
    mentionedUserIds: string[];
  }) {
    const optimistic: CommentRow = {
      id: `temp-${Date.now()}`,
      taskId,
      body: payload.body,
      createdAt: new Date().toISOString(),
      author: { id: me.id, name: me.name },
      mentions: payload.mentionedUserIds.map((userId) => ({
        userId,
        name: "",
      })),
    };

    setComments((prev) => [...prev, optimistic]);

    try {
      const created = await commentsApi.create(taskId, payload);
      setComments((prev) =>
        prev.map((c) => (c.id === optimistic.id ? created : c)),
      );
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      toast.error("Failed to post comment.");
    }
  }

  async function handleDelete(commentId: string) {
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await commentsApi.remove(commentId);
    } catch {
      setComments(previous);
      toast.error("Failed to delete comment.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        Comments
      </span>

      {loading ? (
        <TaskRowSkeleton count={2} />
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-border bg-surface-muted/50 px-4 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent-tint text-accent-strong">
            <MessageSquare className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-[14px] font-medium text-foreground">
            No comments yet
          </p>
          <p className="max-w-[240px] text-[13px] text-text-muted">
            Start the conversation or mention a project member.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((comment) => {
            const isOwn = comment.author.id === me.id;
            const canDelete = isOwn || canModerate;

            return (
              <article
                key={comment.id}
                className="group flex gap-2.5"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-medium text-primary-foreground",
                    avatarColor(comment.author.name),
                  )}
                  aria-hidden
                >
                  {initials(comment.author.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground">
                      {isOwn ? "You" : comment.author.name}
                    </span>
                    <time
                      dateTime={comment.createdAt}
                      className="text-[12px] text-text-muted"
                    >
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true,
                      })}
                    </time>
                    {canDelete && !comment.id.startsWith("temp-") && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(comment.id)}
                        className={cn(
                          "ml-auto flex size-6 items-center justify-center rounded-[4px] text-text-muted opacity-0 transition-opacity",
                          "hover:bg-danger-tint hover:text-danger focus-visible:opacity-100 group-hover:opacity-100",
                          "motion-reduce:transition-none",
                        )}
                        aria-label="Delete comment"
                      >
                        <Trash2 className="size-3.5" strokeWidth={2} />
                      </button>
                    )}
                  </div>

                  <div
                    className={cn(
                      "rounded-[10px] border px-3.5 py-2.5 text-[14px] leading-5 text-foreground",
                      isOwn
                        ? "border-border bg-accent-tint"
                        : "border-border bg-card",
                    )}
                  >
                    {renderCommentBody(comment.body, comment.mentions)}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <MentionInput
        projectId={projectId}
        meName={me.name}
        onSubmit={handleCreate}
      />
    </div>
  );
}
