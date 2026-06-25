import { InlineSpinner } from "@/components/ui/inline-spinner";
import { cn } from "@/lib/utils";

export type AssistantMessageRole = "user" | "assistant";

type AssistantMessageProps = {
  role: AssistantMessageRole;
  content: string;
  streaming?: boolean;
  className?: string;
};

export function AssistantMessage({
  role,
  content,
  streaming = false,
  className,
}: AssistantMessageProps) {
  const isAssistant = role === "assistant";
  const trimmed = content.trim();

  if (isAssistant && !trimmed && !streaming) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        role === "user" ? "items-end" : "items-start",
        className,
      )}
    >
      <span className="text-[11px] font-medium text-text-muted">
        {isAssistant ? "Assistant" : "You"}
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-[10px] border border-border px-3.5 py-2.5 text-[14px] leading-5 text-foreground",
          isAssistant ? "bg-card" : "bg-accent-tint",
        )}
      >
        {streaming && !trimmed ? (
          <span className="inline-flex items-center gap-2 text-text-muted">
            <InlineSpinner className="size-3.5" />
            <span className="sr-only">Assistant is responding</span>
          </span>
        ) : (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        )}
      </div>
    </div>
  );
}
