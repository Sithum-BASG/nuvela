"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Send } from "lucide-react";

import { InlineSpinner } from "@/components/ui/inline-spinner";

import { projectsApi } from "@/lib/projects-api";
import type { MemberRow } from "@/lib/projects-api.types";
import { avatarColor, initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

export type MentionSubmitPayload = {
  body: string;
  mentionedUserIds: string[];
};

type Props = {
  projectId: string;
  meName: string;
  disabled?: boolean;
  onSubmit: (payload: MentionSubmitPayload) => void | Promise<void>;
};

function mentionHandle(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.toLowerCase();
}

export function MentionInput({
  projectId,
  meName,
  disabled,
  onSubmit,
}: Props) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [body, setBody] = useState("");
  const [mentionedIds, setMentionedIds] = useState<Set<string>>(new Set());
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    projectsApi.members
      .list(projectId)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [projectId]);

  const filteredMembers = members.filter((member) => {
    if (!mentionQuery) return true;
    const q = mentionQuery.toLowerCase();
    return (
      member.name.toLowerCase().includes(q) ||
      mentionHandle(member.name).includes(q)
    );
  });

  const closeMention = useCallback(() => {
    setMentionOpen(false);
    setMentionQuery("");
    setMentionIndex(0);
  }, []);

  useEffect(() => {
    if (!mentionOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeMention();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mentionOpen, closeMention]);

  function syncMentionState(value: string, cursor: number) {
    const before = value.slice(0, cursor);
    const atMatch = before.match(/@([^\s@]*)$/);
    if (atMatch) {
      setMentionOpen(true);
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
      return;
    }
    closeMention();
  }

  function insertMention(member: MemberRow) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursor = textarea.selectionStart;
    const before = body.slice(0, cursor);
    const after = body.slice(cursor);
    const atIndex = before.lastIndexOf("@");
    if (atIndex === -1) return;

    const mentionText = `@${member.name.split(/\s+/)[0]} `;
    const nextBody = before.slice(0, atIndex) + mentionText + after;
    setBody(nextBody);
    setMentionedIds((prev) => new Set(prev).add(member.userId));
    closeMention();

    requestAnimationFrame(() => {
      const pos = atIndex + mentionText.length;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
    });
  }

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    try {
      await onSubmit({
        body: trimmed,
        mentionedUserIds: [...mentionedIds],
      });
      setBody("");
      setMentionedIds(new Set());
      closeMention();
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionOpen && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredMembers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + filteredMembers.length) % filteredMembers.length,
        );
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMention();
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <div ref={containerRef} className="relative flex w-full gap-2.5">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-medium text-primary-foreground",
          avatarColor(meName),
        )}
        aria-hidden
      >
        {initials(meName)}
      </span>

      <div className="relative min-w-0 flex-1">
        {mentionOpen && filteredMembers.length > 0 && (
          <div
            role="listbox"
            id={listboxId}
            className={cn(
              "absolute bottom-full left-0 z-50 mb-2 w-60 overflow-hidden rounded-[10px] border border-border bg-popover p-1 shadow-lg",
              "motion-reduce:animate-none",
            )}
          >
            {filteredMembers.map((member, index) => (
              <button
                key={member.userId}
                type="button"
                role="option"
                aria-selected={index === mentionIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(member);
                }}
                className={cn(
                  "flex h-[38px] w-full items-center gap-2 rounded-[6px] px-2 text-left transition-colors motion-reduce:transition-none",
                  index === mentionIndex
                    ? "bg-accent-tint"
                    : "hover:bg-surface-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-primary-foreground",
                    avatarColor(member.name),
                  )}
                >
                  {initials(member.name)}
                </span>
                <span className="truncate text-[13px] font-medium text-foreground">
                  {member.name}
                </span>
                <span className="ml-auto truncate text-[12px] text-text-muted">
                  @{mentionHandle(member.name)}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex min-h-[44px] items-end gap-2 rounded-[10px] border border-border bg-card px-3.5 py-1.5">
          <textarea
            ref={textareaRef}
            value={body}
            rows={1}
            disabled={disabled || sending}
            placeholder="Write a comment…"
            aria-label="Write a comment"
            className="max-h-28 min-h-[28px] flex-1 resize-none bg-transparent text-[14px] leading-5 text-foreground placeholder:text-text-muted focus:outline-none"
            onChange={(e) => {
              setBody(e.target.value);
              syncMentionState(e.target.value, e.target.selectionStart);
            }}
            onClick={(e) =>
              syncMentionState(
                e.currentTarget.value,
                e.currentTarget.selectionStart,
              )
            }
            onKeyUp={(e) =>
              syncMentionState(
                e.currentTarget.value,
                e.currentTarget.selectionStart,
              )
            }
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            disabled={!body.trim() || disabled || sending}
            onClick={() => void handleSubmit()}
            className={cn(
              "mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-primary text-primary-foreground transition-opacity",
              "hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              "motion-reduce:transition-none",
            )}
            aria-label="Send comment"
          >
            {sending ? (
              <InlineSpinner className="size-4 text-primary-foreground" />
            ) : (
              <Send className="size-4" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
