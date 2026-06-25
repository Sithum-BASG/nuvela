import { apiFetch } from "./api-client";
import type { CommentRow } from "./comments-api";
import type { TaskRow } from "./tasks-api.types";

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export type AssistantPageContext = {
  route?: string;
  projectId?: string;
  taskId?: string;
};

export type AssistantActionProposal =
  | {
      type: "create_task";
      projectId: string;
      title: string;
      description?: string;
      priority?: "LOW" | "MEDIUM" | "HIGH";
      dueDate?: string;
      assigneeIds?: string[];
    }
  | {
      type: "post_comment";
      taskId: string;
      body: string;
      mentionedUserIds?: string[];
    };

export type AssistantStreamEvent =
  | { type: "text"; content: string }
  | { type: "action_proposal"; proposal: AssistantActionProposal }
  | { type: "done" }
  | { type: "error"; code: string; message: string };

type AssistantChatInput = {
  message: string;
  page?: AssistantPageContext;
};

export async function streamAssistantChat(
  input: AssistantChatInput,
  onEvent: (event: AssistantStreamEvent) => void,
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(`${BASE}/assistant/chat`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    emitRequestError(onEvent);
    return;
  }

  if (!response.ok || !response.body) {
    emitRequestError(onEvent);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!emitParsedLine(line, onEvent)) {
          await reader.cancel().catch(() => undefined);
          return;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim() && !emitParsedLine(buffer, onEvent)) {
      await reader.cancel().catch(() => undefined);
    }
  } catch {
    emitRequestError(onEvent);
  }
}

export const assistantApi = {
  confirmCreateTask: (
    proposal: Extract<AssistantActionProposal, { type: "create_task" }>,
  ) =>
    apiFetch<TaskRow>("/assistant/actions/create-task", "POST", proposal),
  confirmPostComment: (
    proposal: Extract<AssistantActionProposal, { type: "post_comment" }>,
  ) =>
    apiFetch<CommentRow>("/assistant/actions/post-comment", "POST", proposal),
};

function emitParsedLine(
  line: string,
  onEvent: (event: AssistantStreamEvent) => void,
): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!isAssistantStreamEvent(parsed)) {
      emitRequestError(onEvent);
      return false;
    }
    onEvent(parsed);
    return true;
  } catch {
    emitRequestError(onEvent);
    return false;
  }
}

function emitRequestError(
  onEvent: (event: AssistantStreamEvent) => void,
): void {
  onEvent({
    type: "error",
    code: "ASSISTANT_REQUEST_FAILED",
    message: "The assistant could not respond. Please try again.",
  });
}

function isAssistantStreamEvent(value: unknown): value is AssistantStreamEvent {
  if (!isRecord(value) || typeof value.type !== "string") return false;

  if (value.type === "text") {
    return typeof value.content === "string";
  }

  if (value.type === "action_proposal") {
    return isAssistantActionProposal(value.proposal);
  }

  if (value.type === "done") {
    return true;
  }

  if (value.type === "error") {
    return typeof value.code === "string" && typeof value.message === "string";
  }

  return false;
}

function isAssistantActionProposal(
  value: unknown,
): value is AssistantActionProposal {
  if (!isRecord(value) || typeof value.type !== "string") return false;

  if (value.type === "create_task") {
    return (
      typeof value.projectId === "string" && typeof value.title === "string"
    );
  }

  if (value.type === "post_comment") {
    return typeof value.taskId === "string" && typeof value.body === "string";
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
