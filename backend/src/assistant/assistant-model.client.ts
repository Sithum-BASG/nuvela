import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type NvidiaChatResponse = {
  choices?: { message?: { content?: string } }[];
};

const ASSISTANT_PROVIDER_TIMEOUT_MS = 30000;

@Injectable()
export class AssistantModelClient {
  constructor(private readonly config: ConfigService) {}

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = this.config.get<string>('NVIDIA_API_KEY');
    const baseUrl =
      this.config.get<string>('NVIDIA_BASE_URL') ??
      'https://integrate.api.nvidia.com/v1';
    const model =
      this.config.get<string>('NVIDIA_MODEL') ?? 'deepseek-ai/deepseek-v4-pro';

    if (!apiKey) {
      throw new InternalServerErrorException({
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'Assistant provider is not configured.',
      });
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ASSISTANT_PROVIDER_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(
        `${baseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
          }),
          signal: controller.signal,
        },
      );
    } catch (error) {
      if (timedOut || isAbortError(error)) {
        throw new InternalServerErrorException({
          code: 'PROVIDER_TIMEOUT',
          message: 'Assistant provider request timed out.',
        });
      }

      throw new InternalServerErrorException({
        code: 'PROVIDER_REQUEST_FAILED',
        message: 'Assistant provider request failed.',
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new InternalServerErrorException({
        code: 'PROVIDER_FAILED',
        message: 'Assistant provider failed.',
      });
    }

    let data: NvidiaChatResponse;
    try {
      data = (await response.json()) as NvidiaChatResponse;
    } catch {
      throw new InternalServerErrorException({
        code: 'PROVIDER_INVALID_RESPONSE',
        message: 'Assistant provider returned an invalid response.',
      });
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new InternalServerErrorException({
        code: 'PROVIDER_EMPTY_RESPONSE',
        message: 'Assistant provider returned an empty response.',
      });
    }
    return content;
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException ||
    (typeof error === 'object' && error !== null && 'name' in error)
  ) && (error as { name?: string }).name === 'AbortError';
}
