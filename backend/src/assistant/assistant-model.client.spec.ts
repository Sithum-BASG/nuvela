import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantModelClient } from './assistant-model.client';

describe('AssistantModelClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws PROVIDER_NOT_CONFIGURED when API key is missing', async () => {
    const config = new ConfigService({
      NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      NVIDIA_MODEL: 'deepseek-ai/deepseek-v4-pro',
    });
    const client = new AssistantModelClient(config);

    await expect(client.complete('system', 'hello')).rejects.toMatchObject({
      response: { code: 'PROVIDER_NOT_CONFIGURED' },
    });
  });

  it('calls NVIDIA chat completions with the configured model', async () => {
    const config = new ConfigService({
      NVIDIA_API_KEY: 'key',
      NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      NVIDIA_MODEL: 'deepseek-ai/deepseek-v4-pro',
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Hello' } }] }),
    } as Response);

    const client = new AssistantModelClient(config);
    await expect(client.complete('system', 'hello')).resolves.toBe('Hello');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer key',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('wraps provider failures in a structured error', async () => {
    const config = new ConfigService({
      NVIDIA_API_KEY: 'key',
      NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      NVIDIA_MODEL: 'deepseek-ai/deepseek-v4-pro',
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'rate limited',
    } as Response);

    const client = new AssistantModelClient(config);
    await expect(client.complete('system', 'hello')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
