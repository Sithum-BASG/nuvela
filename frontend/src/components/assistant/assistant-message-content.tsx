import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type AssistantMessageContentProps = {
  content: string;
  className?: string;
};

type ContentBlock =
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; items: ListItem[] };

type ListItem = {
  content: string;
  children: string[];
};

export function AssistantMessageContent({
  content,
  className,
}: AssistantMessageContentProps) {
  const blocks = parseAssistantBlocks(content);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 text-[14px] leading-[1.55] text-foreground [text-wrap:pretty]",
        className,
      )}
    >
      {blocks.map((block, index) => (
        <Fragment key={index}>{renderBlock(block, index)}</Fragment>
      ))}
    </div>
  );
}

function renderBlock(block: ContentBlock, blockIndex: number): ReactNode {
  if (block.type === "paragraph") {
    return (
      <p className="text-[14px] leading-[1.55] text-foreground">
        {block.lines.map((line, lineIndex) => (
          <Fragment key={lineIndex}>
            {lineIndex > 0 ? <br /> : null}
            {renderInline(line, `${blockIndex}-p-${lineIndex}`)}
          </Fragment>
        ))}
      </p>
    );
  }

  const ListTag = block.ordered ? "ol" : "ul";

  return (
    <ListTag className="m-0 flex list-none flex-col gap-2.5 p-0">
      {block.items.map((item, itemIndex) => (
        <li
          key={itemIndex}
          className={cn("flex gap-2.5", block.ordered ? "items-start" : "items-start")}
        >
          {block.ordered ? (
            <span
              aria-hidden
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-tint text-[11px] font-medium text-primary"
            >
              {itemIndex + 1}
            </span>
          ) : (
            <span
              aria-hidden
              className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-text-muted"
            />
          )}
          <div className="min-w-0 flex-1">
            <div>{renderInline(item.content, `${blockIndex}-li-${itemIndex}`)}</div>
            {item.children.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1.5 border-l border-border pl-3">
                {item.children.map((child, childIndex) => (
                  <li
                    key={childIndex}
                    className="flex gap-2 text-[13px] leading-[1.5] text-text-secondary"
                  >
                    <span
                      aria-hidden
                      className="mt-[0.5rem] size-1 shrink-0 rounded-full bg-border"
                    />
                    <span className="min-w-0 flex-1">
                      {renderInline(
                        child,
                        `${blockIndex}-li-${itemIndex}-c-${childIndex}`,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ListTag>
  );
}

function parseAssistantBlocks(content: string): ContentBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ContentBlock[] = [];
  let paragraph: string[] = [];
  let list: ListItem[] | null = null;
  let ordered = false;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", lines: paragraph });
    paragraph = [];
  };

  const flushList = () => {
    if (!list || list.length === 0) return;
    blocks.push({ type: "list", ordered, items: list });
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const nestedBulletMatch = line.match(/^\s+[-*]\s+(.+)$/);

    if (orderedMatch) {
      flushParagraph();
      if (!list) {
        list = [];
        ordered = true;
      } else if (!ordered) {
        flushList();
        list = [];
        ordered = true;
      }
      list.push({ content: orderedMatch[2], children: [] });
      continue;
    }

    if (nestedBulletMatch && list && list.length > 0) {
      flushParagraph();
      list[list.length - 1].children.push(nestedBulletMatch[1]);
      continue;
    }

    if (bulletMatch) {
      flushParagraph();
      if (!list) {
        list = [];
        ordered = false;
      } else if (ordered) {
        flushList();
        list = [];
        ordered = false;
      }
      list.push({ content: bulletMatch[1], children: [] });
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  if (blocks.length === 0 && content.trim()) {
    return [{ type: "paragraph", lines: [content.trim()] }];
  }

  return blocks;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    parts.push(
      <strong
        key={`${keyPrefix}-strong-${partIndex++}`}
        className="font-medium text-foreground"
      >
        {match[1]}
      </strong>,
    );
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
