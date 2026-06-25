import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { AssistantActionParser } from './assistant-action.parser';
import { AssistantContextBuilder } from './assistant-context.builder';
import { AssistantModelClient } from './assistant-model.client';
import type { AssistantStreamEvent } from './assistant.types';
import type { AssistantChatDto } from './dto/assistant-chat.dto';

const TEXT_CHUNK_SIZE = 80;

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly contextBuilder: AssistantContextBuilder,
    private readonly modelClient: AssistantModelClient,
    private readonly actionParser: AssistantActionParser,
  ) {}

  async streamChat(
    caller: CurrentUserPayload,
    dto: AssistantChatDto,
    response: Response,
  ): Promise<void> {
    try {
      this.setStreamHeaders(response);

      const context = await this.contextBuilder.build(caller, dto.page);
      const output = await this.modelClient.complete(
        this.buildSystemPrompt(),
        this.buildUserPrompt(context.summary, dto.message),
      );

      const visibleText = removeActionJsonBlock(output);
      for (const content of chunkText(visibleText, TEXT_CHUNK_SIZE)) {
        this.writeEvent(response, { type: 'text', content });
      }

      const proposal = this.actionParser.parse(output);
      if (proposal) {
        this.writeEvent(response, { type: 'action_proposal', proposal });
      }

      this.writeEvent(response, { type: 'done' });
    } catch (error) {
      this.logger.error('Assistant chat failed', error);
      const mapped = mapAssistantStreamError(error);
      this.writeEvent(response, {
        type: 'error',
        code: mapped.code,
        message: mapped.message,
      });
    } finally {
      response.end();
    }
  }

  private setStreamHeaders(response: Response): void {
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('X-Accel-Buffering', 'no');
  }

  private buildSystemPrompt(): string {
    return [
      'You are Nuvela Assistant, a calm project-work assistant.',
      'You must use only the provided context and never rely on outside facts or hidden project data.',
      'Preserve role boundaries exactly as Nuvela provides them; admins cannot access project or task content.',
      'Do not claim attachment contents because only attachment counts may be available.',
      'Allowed proposals only: create_task or post_comment.',
      'Do not propose or perform any other mutations/actions, including moving tasks, editing fields, inviting users, archiving projects, or changing organization settings.',
      'Answer visibly in normal text first.',
      'Format answers for readability with short paragraphs and simple Markdown only: **bold labels**, numbered lists for projects, and hyphen bullets for tasks.',
      'Put each task on its own bullet line; avoid dense comma-separated lists in a single sentence.',
      'If and only if you propose an allowed action, put the machine-readable action in exactly one ACTION_JSON: block at the very end.',
      'The ACTION_JSON: block must contain compact JSON and no prose after it.',
    ].join('\n');
  }

  private buildUserPrompt(contextSummary: string, message: string): string {
    return [
      'Context summary:',
      contextSummary,
      '',
      'User message:',
      message,
    ].join('\n');
  }

  private writeEvent(response: Response, event: AssistantStreamEvent): void {
    response.write(`${JSON.stringify(event)}\n`);
  }
}

function removeActionJsonBlock(output: string): string {
  const marker = 'ACTION_JSON:';
  const index = output.lastIndexOf(marker);
  if (index === -1) {
    return output.trimEnd();
  }

  return output.slice(0, index).trimEnd();
}

function mapAssistantStreamError(error: unknown): {
  code: string;
  message: string;
} {
  const provider = readStructuredError(error);
  if (provider) {
    if (provider.code === 'PROVIDER_NOT_CONFIGURED') {
      return {
        code: provider.code,
        message:
          'The assistant is not configured on the server. Set NVIDIA_API_KEY in the backend environment and redeploy.',
      };
    }

    if (provider.code === 'PROVIDER_TIMEOUT') {
      return {
        code: provider.code,
        message: 'The assistant timed out. Please try again.',
      };
    }

    return {
      code: provider.code,
      message: 'The assistant could not respond. Please try again.',
    };
  }

  return {
    code: 'ASSISTANT_FAILED',
    message: 'The assistant could not respond. Please try again.',
  };
}

function readStructuredError(
  error: unknown,
): { code: string; message: string } | null {
  if (!(error instanceof InternalServerErrorException)) {
    return null;
  }

  const response = error.getResponse();
  if (
    typeof response === 'object' &&
    response !== null &&
    'code' in response &&
    typeof response.code === 'string'
  ) {
    return {
      code: response.code,
      message:
        'message' in response && typeof response.message === 'string'
          ? response.message
          : 'Assistant provider failed.',
    };
  }

  return null;
}

function chunkText(text: string, chunkSize: number): string[] {
  if (!text) return [];

  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }
  return chunks;
}
