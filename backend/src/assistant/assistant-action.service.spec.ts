import { Priority, Role } from '@prisma/client';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { CommentsService } from '../tasks/comments.service';
import { TasksService } from '../tasks/tasks.service';
import { AssistantActionService } from './assistant-action.service';

describe('AssistantActionService', () => {
  const caller: CurrentUserPayload = {
    userId: 'user-1',
    role: Role.PROJECT_MANAGER,
    organizationId: 'org-1',
  };

  let tasksService: { createTask: jest.Mock };
  let commentsService: { createComment: jest.Mock };
  let service: AssistantActionService;

  beforeEach(() => {
    tasksService = {
      createTask: jest.fn().mockResolvedValue({ id: 'task-1' }),
    };
    commentsService = {
      createComment: jest.fn().mockResolvedValue({ id: 'comment-1' }),
    };
    service = new AssistantActionService(
      tasksService as unknown as TasksService,
      commentsService as unknown as CommentsService,
    );
  });

  it('delegates confirmed task creation without passing projectId in the DTO', async () => {
    const result = await service.confirmCreateTask(caller, {
      projectId: 'project-1',
      title: 'Prepare launch notes',
      description: 'Draft rollout notes for the release.',
      priority: Priority.HIGH,
      dueDate: '2026-07-02T00:00:00.000Z',
      assigneeIds: ['assignee-1', 'assignee-2'],
    });

    expect(result).toEqual({ id: 'task-1' });
    expect(tasksService.createTask).toHaveBeenCalledWith(caller, 'project-1', {
      title: 'Prepare launch notes',
      description: 'Draft rollout notes for the release.',
      priority: Priority.HIGH,
      dueDate: '2026-07-02T00:00:00.000Z',
      assigneeIds: ['assignee-1', 'assignee-2'],
    });
  });

  it('delegates confirmed comment posting without passing taskId in the DTO', async () => {
    const result = await service.confirmPostComment(caller, {
      taskId: 'task-1',
      body: 'Please review the latest copy.',
      mentionedUserIds: ['mentioned-1', 'mentioned-2'],
    });

    expect(result).toEqual({ id: 'comment-1' });
    expect(commentsService.createComment).toHaveBeenCalledWith(
      caller,
      'task-1',
      {
        body: 'Please review the latest copy.',
        mentionedUserIds: ['mentioned-1', 'mentioned-2'],
      },
    );
  });
});
