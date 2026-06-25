import { Priority } from '@prisma/client';

export type AssistantPageContext = {
  route?: string;
  projectId?: string;
  taskId?: string;
};

export type AssistantActionProposal =
  | {
      type: 'create_task';
      projectId: string;
      title: string;
      description?: string;
      priority?: Priority;
      dueDate?: string;
      assigneeIds?: string[];
    }
  | {
      type: 'post_comment';
      taskId: string;
      body: string;
      mentionedUserIds?: string[];
    };

export type AssistantContext = {
  user: {
    userId: string;
    role: string;
    organizationId: string;
  };
  page?: AssistantPageContext;
  summary: string;
};

export type AssistantStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'action_proposal'; proposal: AssistantActionProposal }
  | { type: 'done' }
  | { type: 'error'; code: string; message: string };
