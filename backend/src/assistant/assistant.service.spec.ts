import { Role } from '@prisma/client';
import type { Response } from 'express';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { AssistantContextBuilder } from './assistant-context.builder';
import { AssistantModelClient } from './assistant-model.client';
import { AssistantService } from './assistant.service';
import type { AssistantStreamEvent } from './assistant.types';

type MockResponse = {
  setHeader: jest.Mock;
  write: jest.Mock;
  end: jest.Mock;
};

describe('AssistantService', () => {
  const caller: CurrentUserPayload = {
    userId: 'pm-1',
    role: Role.PROJECT_MANAGER,
    organizationId: 'org-1',
  };

  let contextBuilder: { build: jest.Mock };
  let modelClient: { complete: jest.Mock };
  let actionParser: { parse: jest.Mock };
  let response: MockResponse;
  let service: AssistantService;

  beforeEach(() => {
    contextBuilder = {
      build: jest.fn().mockResolvedValue({
        user: caller,
        page: { route: '/projects/project-1', projectId: 'project-1' },
        summary: 'Task snapshot: Prepare launch notes in Website.',
      }),
    };
    modelClient = {
      complete: jest.fn().mockResolvedValue('Here is the plan.'),
    };
    actionParser = {
      parse: jest.fn().mockReturnValue(null),
    };
    response = {
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
    service = new AssistantService(
      contextBuilder as unknown as AssistantContextBuilder,
      modelClient as unknown as AssistantModelClient,
      actionParser,
    );
  });

  it('writes headers, text events, an optional action proposal, and done', async () => {
    const proposal = {
      type: 'create_task',
      projectId: 'project-1',
      title: 'Write launch notes',
    };
    modelClient.complete.mockResolvedValue(
      'I can draft that task.\nACTION_JSON: {"type":"create_task","projectId":"project-1","title":"Write launch notes"}',
    );
    actionParser.parse.mockReturnValue(proposal);

    await service.streamChat(
      caller,
      {
        message: 'Create a launch notes task.',
        page: { route: '/projects/project-1', projectId: 'project-1' },
      },
      response as unknown as Response,
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/x-ndjson; charset=utf-8',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-cache, no-transform',
    );
    expect(response.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(contextBuilder.build).toHaveBeenCalledWith(caller, {
      route: '/projects/project-1',
      projectId: 'project-1',
    });
    expect(modelClient.complete).toHaveBeenCalledWith(
      expect.stringContaining('use only the provided context'),
      expect.stringContaining(
        'Task snapshot: Prepare launch notes in Website.',
      ),
    );
    expect(modelClient.complete).toHaveBeenCalledWith(
      expect.stringContaining('admins cannot access project or task content'),
      expect.stringContaining('User message:\nCreate a launch notes task.'),
    );
    expect(actionParser.parse).toHaveBeenCalledWith(
      'I can draft that task.\nACTION_JSON: {"type":"create_task","projectId":"project-1","title":"Write launch notes"}',
    );

    const events = writtenEvents(response);
    const text = events
      .filter(
        (event): event is Extract<AssistantStreamEvent, { type: 'text' }> =>
          event.type === 'text',
      )
      .map((event) => event.content)
      .join('');
    expect(text).toBe('I can draft that task.');
    expect(events).toContainEqual({
      type: 'action_proposal',
      proposal,
    });
    expect(events.at(-1)).toEqual({ type: 'done' });
    expect(response.end).toHaveBeenCalledTimes(1);
  });

  it('removes the trailing ACTION_JSON block from visible text but still parses the full output', async () => {
    const output =
      'Please review this before I post it.\nACTION_JSON: {"type":"post_comment","taskId":"task-1","body":"Looks good."}';
    modelClient.complete.mockResolvedValue(output);
    actionParser.parse.mockReturnValue({
      type: 'post_comment',
      taskId: 'task-1',
      body: 'Looks good.',
    });

    await service.streamChat(
      caller,
      { message: 'Comment on this task.', page: { taskId: 'task-1' } },
      response as unknown as Response,
    );

    expect(actionParser.parse).toHaveBeenCalledWith(output);
    const text = writtenEvents(response)
      .filter(
        (event): event is Extract<AssistantStreamEvent, { type: 'text' }> =>
          event.type === 'text',
      )
      .map((event) => event.content)
      .join('');
    expect(text).toBe('Please review this before I post it.');
    expect(text).not.toContain('ACTION_JSON');
  });

  it('writes a generic error event and ends the response on failure', async () => {
    modelClient.complete.mockRejectedValue(new Error('provider details'));

    await service.streamChat(
      caller,
      { message: 'Summarize this.' },
      response as unknown as Response,
    );

    expect(writtenEvents(response)).toEqual([
      {
        type: 'error',
        code: 'ASSISTANT_FAILED',
        message: 'The assistant could not respond. Please try again.',
      },
    ]);
    expect(response.end).toHaveBeenCalledTimes(1);
  });
});

function writtenEvents(response: MockResponse): AssistantStreamEvent[] {
  return response.write.mock.calls.map(([line]) => {
    if (typeof line !== 'string') {
      throw new Error('Expected response.write to receive a string.');
    }
    return JSON.parse(line) as AssistantStreamEvent;
  });
}
