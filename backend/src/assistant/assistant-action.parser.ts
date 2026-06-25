import { Injectable } from '@nestjs/common';
import { Priority } from '@prisma/client';
import type { AssistantActionProposal } from './assistant.types';

@Injectable()
export class AssistantActionParser {
  parse(output: string): AssistantActionProposal | null {
    const marker = 'ACTION_JSON:';
    const index = output.lastIndexOf(marker);
    if (index === -1) return null;

    const raw = output.slice(index + marker.length).trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!isRecord(parsed) || typeof parsed.type !== 'string') return null;

    if (parsed.type === 'create_task') {
      if (
        typeof parsed.projectId !== 'string' ||
        typeof parsed.title !== 'string'
      ) {
        return null;
      }
      const proposal: AssistantActionProposal = {
        type: 'create_task',
        projectId: parsed.projectId,
        title: parsed.title,
      };
      if (typeof parsed.description === 'string') {
        proposal.description = parsed.description;
      }
      if (typeof parsed.priority === 'string' && isPriority(parsed.priority)) {
        proposal.priority = parsed.priority;
      }
      if (typeof parsed.dueDate === 'string') proposal.dueDate = parsed.dueDate;
      if (Array.isArray(parsed.assigneeIds)) {
        proposal.assigneeIds = parsed.assigneeIds.filter(
          (id): id is string => typeof id === 'string',
        );
      }
      return proposal;
    }

    if (parsed.type === 'post_comment') {
      if (typeof parsed.taskId !== 'string' || typeof parsed.body !== 'string') {
        return null;
      }
      const proposal: AssistantActionProposal = {
        type: 'post_comment',
        taskId: parsed.taskId,
        body: parsed.body,
      };
      if (Array.isArray(parsed.mentionedUserIds)) {
        proposal.mentionedUserIds = parsed.mentionedUserIds.filter(
          (id): id is string => typeof id === 'string',
        );
      }
      return proposal;
    }

    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPriority(value: string): value is Priority {
  return (
    value === Priority.LOW ||
    value === Priority.MEDIUM ||
    value === Priority.HIGH
  );
}
