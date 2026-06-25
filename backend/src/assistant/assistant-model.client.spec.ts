import { ConfigService } from '@nestjs/config';
import { AssistantModelClient } from './assistant-model.client';

describe('AssistantModelClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.useRealTimers();
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
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'deepseek-ai/deepseek-v4-pro',
      messages: [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'hello' },
      ],
      temperature: 0.2,
    });
  });

  it('wraps provider HTTP failures in a generic structured error', async () => {
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
    await expect(client.complete('system', 'hello')).rejects.toMatchObject({
      response: {
        code: 'PROVIDER_FAILED',
        message: 'Assistant provider failed.',
      },
    });
    await expect(client.complete('system', 'hello')).rejects.not.toMatchObject({
      response: { description: expect.any(String) },
    });
  });

  it('wraps rejected fetch calls in a structured error', async () => {
    const config = new ConfigService({
      NVIDIA_API_KEY: 'key',
      NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      NVIDIA_MODEL: 'deepseek-ai/deepseek-v4-pro',
    });
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const client = new AssistantModelClient(config);
    await expect(client.complete('system', 'hello')).rejects.toMatchObject({
      response: {
        code: 'PROVIDER_REQUEST_FAILED',
        message: 'Assistant provider request failed.',
      },
    });
  });

  it('wraps invalid JSON responses in a structured error', async () => {
    const config = new ConfigService({
      NVIDIA_API_KEY: 'key',
      NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      NVIDIA_MODEL: 'deepseek-ai/deepseek-v4-pro',
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    } as unknown as Response);

    const client = new AssistantModelClient(config);
    await expect(client.complete('system', 'hello')).rejects.toMatchObject({
      response: {
        code: 'PROVIDER_INVALID_RESPONSE',
        message: 'Assistant provider returned an invalid response.',
      },
    });
  });

  it('aborts slow provider calls with a structured timeout error', async () => {
    jest.useFakeTimers();
    const config = new ConfigService({
      NVIDIA_API_KEY: 'key',
      NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      NVIDIA_MODEL: 'deepseek-ai/deepseek-v4-pro',
    });
    global.fetch = jest.fn().mockImplementation((_url, init: RequestInit) => {
      const signal = init.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });

    const client = new AssistantModelClient(config);
    const result = client.complete('system', 'hello');
    jest.advanceTimersByTime(30000);

    await expect(result).rejects.toMatchObject({
      response: {
        code: 'PROVIDER_TIMEOUT',
        message: 'Assistant provider request timed out.',
      },
    });
  });
});
