import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type NvidiaChatResponse = {
  choices?: { message?: { content?: string } }[];
};

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

    const response = await fetch(
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
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new InternalServerErrorException({
        code: 'PROVIDER_FAILED',
        message: `Assistant provider failed (${response.status} ${response.statusText}).`,
        description: detail.slice(0, 500),
      });
    }

    const data = (await response.json()) as NvidiaChatResponse;
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
