"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Send, X } from "lucide-react";

import { AssistantActionCard } from "@/components/assistant/assistant-action-card";
import { AssistantMessage } from "@/components/assistant/assistant-message";
import { assistantPrompts } from "@/components/assistant/assistant-prompts";
import {
  AssistantTaskGuide,
  extractInitialTaskTitle,
  isCreateTaskIntent,
} from "@/components/assistant/assistant-task-guide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  streamAssistantChat,
  type AssistantActionProposal,
  type AssistantPageContext,
} from "@/lib/assistant-api";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

type AssistantDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  COLLABORATOR: "Collaborator",
};

const ASSISTANT_REQUEST_TIMEOUT_MS = 35000;

export function AssistantDrawer({ open, onOpenChange }: AssistantDrawerProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [proposal, setProposal] = useState<AssistantActionProposal | null>(
    null,
  );
  const [taskGuide, setTaskGuide] = useState<{
    id: string;
    initialTitle?: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const activeAssistantMessageId = useRef<string | null>(null);

  const { projectId, taskId } = useMemo(
    () => extractAssistantRouteContext(pathname),
    [pathname],
  );

  const pageContext = useMemo<AssistantPageContext>(
    () => ({
      route: pathname,
      projectId,
      taskId,
    }),
    [pathname, projectId, taskId],
  );

  const starterPrompts = useMemo(
    () => assistantPrompts(user?.role),
    [user?.role],
  );
  const roleLabel = user ? ROLE_LABEL[user.role] ?? user.role : "Workspace";

  const abortActiveStream = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    activeAssistantMessageId.current = null;
  }, []);

  const closeDrawer = useCallback((): void => {
    abortActiveStream();
    onOpenChange(false);
  }, [abortActiveStream, onOpenChange]);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      inputRef.current?.focus();
      return;
    }

    abortRef.current?.abort();
    abortRef.current = null;
    activeAssistantMessageId.current = null;
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDrawer();
        return;
      }

      if (event.key === "Tab") {
        trapFocus(event, panelRef.current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDrawer, open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, proposal, streaming, taskGuide]);

  async function send(message = input) {
    const text = message.trim();
    if (!text || streaming) return;

    const userMessageId = String(nextId.current++);
    const assistantMessageId = String(nextId.current++);

    if (isCreateTaskIntent(text)) {
      abortActiveStream();
      setInput("");
      setProposal(null);
      setMessages((prev) => [
        ...prev,
        { id: userMessageId, role: "user", content: text },
        {
          id: assistantMessageId,
          role: "assistant",
          content: projectId
            ? "Let's create it step by step. I will ask for the task details first, then show a review card before saving."
            : "Open a project first, then ask me to create the task from that project.",
        },
      ]);
      setTaskGuide(
        projectId
          ? {
              id: String(nextId.current++),
              initialTitle: extractInitialTaskTitle(text),
            }
          : null,
      );
      return;
    }

    abortActiveStream();
    const controller = new AbortController();
    abortRef.current = controller;
    activeAssistantMessageId.current = assistantMessageId;
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", content: text },
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);
    setInput("");
    setProposal(null);
    setTaskGuide(null);
    setStreaming(true);

    const timeoutId = window.setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort();
        const targetId = activeAssistantMessageId.current;
        if (targetId) {
          setMessages((prev) =>
            prev.map((item) =>
              item.id === targetId && !item.content.trim()
                ? {
                    ...item,
                    content: "The assistant timed out. Please try again.",
                  }
                : item,
            ),
          );
        }
        setProposal(null);
        setStreaming(false);
        activeAssistantMessageId.current = null;
        abortRef.current = null;
      }
    }, ASSISTANT_REQUEST_TIMEOUT_MS);

    try {
      await streamAssistantChat(
        { message: text, page: pageContext },
        (event) => {
          if (controller.signal.aborted) return;

          if (event.type === "text") {
            const targetId = activeAssistantMessageId.current;
            if (!targetId) return;
            setMessages((prev) =>
              prev.map((item) =>
                item.id === targetId
                  ? { ...item, content: item.content + event.content }
                  : item,
              ),
            );
            return;
          }

          if (event.type === "action_proposal") {
            setProposal(event.proposal);
            return;
          }

          if (event.type === "error") {
            const targetId = activeAssistantMessageId.current;
            if (targetId) {
              setMessages((prev) =>
                prev.map((item) =>
                  item.id === targetId
                    ? { ...item, content: event.message }
                    : item,
                ),
              );
            }
            setProposal(null);
            setStreaming(false);
            activeAssistantMessageId.current = null;
            return;
          }

          if (event.type === "done") {
            setStreaming(false);
            activeAssistantMessageId.current = null;
          }
        },
        { signal: controller.signal },
      );
    } finally {
      window.clearTimeout(timeoutId);
      if (abortRef.current === controller) {
        const targetId = activeAssistantMessageId.current;
        abortRef.current = null;
        setStreaming(false);
        activeAssistantMessageId.current = null;
        if (targetId) {
          setMessages((prev) =>
            prev.map((item) =>
              item.id === targetId && !item.content.trim()
                ? {
                    ...item,
                    content:
                      "The assistant could not respond. Please try again.",
                  }
                : item,
            ),
          );
        }
      }
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-[rgba(15,18,26,0.4)] transition-opacity duration-200 motion-reduce:transition-none",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={closeDrawer}
        aria-hidden
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Assistant"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-[70] flex w-[50vw] min-w-[560px] max-w-[820px] flex-col border-l border-border bg-card shadow-[-8px_0_32px_-4px_rgba(0,0,0,0.12)]",
          "max-lg:w-[58vw] max-md:inset-0 max-md:w-full max-md:min-w-0 max-md:max-w-none max-md:border-l-0",
          "transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-primary">
              <Bot className="size-4" strokeWidth={1.9} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-medium text-foreground">
                Assistant
              </h2>
              <p className="truncate text-[12px] text-text-muted">{roleLabel}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={closeDrawer}
            aria-label="Close assistant"
          >
            <X className="size-4" strokeWidth={2} aria-hidden />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 max-md:px-4">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
            {hasMessages ? (
              messages.map((message, index) => (
                <AssistantMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  streaming={
                    message.role === "assistant" &&
                    streaming &&
                    index === messages.length - 1
                  }
                />
              ))
            ) : (
              <div className="flex flex-col gap-2.5">
                {projectId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-11 w-full justify-start whitespace-normal px-3 py-2.5 text-left leading-5"
                    onClick={() => void send("Create a task")}
                  >
                    Create a task
                  </Button>
                ) : null}
                {starterPrompts.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-11 w-full justify-start whitespace-normal px-3 py-2.5 text-left leading-5"
                    onClick={() => void send(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            )}

            {taskGuide && projectId ? (
              <AssistantTaskGuide
                key={taskGuide.id}
                projectId={projectId}
                initialTitle={taskGuide.initialTitle}
                onCancel={() => setTaskGuide(null)}
                onProposal={(nextProposal) => {
                  setTaskGuide(null);
                  setProposal(nextProposal);
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: String(nextId.current++),
                      role: "assistant",
                      content:
                        "Review the task details below. I will only create it after you confirm.",
                    },
                  ]);
                }}
              />
            ) : null}

            {proposal ? (
              <AssistantActionCard
                proposal={proposal}
                onConfirmed={() => setProposal(null)}
                onDismiss={() => setProposal(null)}
              />
            ) : null}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-card px-4 py-4">
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a question"
              aria-label="Assistant message"
              className="h-11"
            />
            <Button
              type="submit"
              variant="default"
              size="icon-lg"
              className="h-11 w-11 shrink-0"
              disabled={streaming || input.trim().length === 0}
              aria-label="Send message"
            >
              {streaming ? (
                <InlineSpinner className="size-4" />
              ) : (
                <Send className="size-4" strokeWidth={2} aria-hidden />
              )}
            </Button>
          </form>
        </div>
      </aside>
    </>
  );
}

function extractAssistantRouteContext(pathname: string): {
  projectId?: string;
  taskId?: string;
} {
  const segments = pathname.split("/").filter(Boolean);
  const taskIndex = segments.indexOf("tasks");
  const taskId = taskIndex >= 0 ? segments[taskIndex + 1] : undefined;

  if (segments[0] !== "projects" || segments[1] === "archived") {
    return taskId ? { taskId } : {};
  }

  const projectId = segments[1];

  return {
    projectId,
    taskId,
  };
}

function trapFocus(event: KeyboardEvent, container: HTMLElement | null): void {
  if (!container) return;

  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "textarea:not([disabled])",
        "select:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    ),
  ).filter((element) => !element.hasAttribute("aria-hidden"));

  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const activeElement = document.activeElement;

  if (!container.contains(activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }

  if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
