import { Injectable } from '@nestjs/common';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { CommentsService } from '../tasks/comments.service';
import { TasksService } from '../tasks/tasks.service';
import type { ConfirmCreateTaskDto } from './dto/confirm-create-task.dto';
import type { ConfirmPostCommentDto } from './dto/confirm-post-comment.dto';

@Injectable()
export class AssistantActionService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly commentsService: CommentsService,
  ) {}

  confirmCreateTask(caller: CurrentUserPayload, dto: ConfirmCreateTaskDto) {
    const { projectId, title, description, priority, dueDate, assigneeIds } =
      dto;

    return this.tasksService.createTask(caller, projectId, {
      title,
      description,
      priority,
      dueDate,
      assigneeIds,
    });
  }

  confirmPostComment(caller: CurrentUserPayload, dto: ConfirmPostCommentDto) {
    const { taskId, body, mentionedUserIds } = dto;

    return this.commentsService.createComment(caller, taskId, {
      body,
      mentionedUserIds,
    });
  }
}
