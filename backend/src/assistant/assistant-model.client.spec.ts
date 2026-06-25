import { ConfigService } from '@nestjs/config';
import { AssistantModelClient } from './assistant-model.client';

type FetchMock = jest.MockedFunction<typeof fetch>;

describe('AssistantModelClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it('throws PROVIDER_NOT_CONFIGURED when API key is missing', async () => {
    const config = new ConfigService({
      NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      NVIDIA_MODEL: 'deepseek-ai/deepseek-v4-flash',
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
      NVIDIA_MODEL: 'deepseek-ai/deepseek-v4-flash',
    });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'Hello' } }] }),
    );

    const client = new AssistantModelClient(config);
    await expect(client.complete('system', 'hello')).resolves.toBe('Hello');
    const [url, init] = getLastFetchCall(fetchMock);
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    const headers = getFetchHeaders(init);
    expect(headers.Authorization).toBe('Bearer key');
    expect(headers['Content-Type']).toBe('application/json');
    const requestBody = parseJsonBody(init);
    expect(requestBody).toEqual({
      model: 'deepseek-ai/deepseek-v4-flash',
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
      NVIDIA_MODEL: 'deepseek-ai/deepseek-v4-flash',
    });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(
      new Response('rate limited', {
        status: 429,
        statusText: 'Too Many Requests',
      }),
    );

    const client = new AssistantModelClient(config);
    const response = await getErrorResponse(client.complete('system', 'hello'));
    expect(response).toMatchObject({
      code: 'PROVIDER_FAILED',
      message: 'Assistant provider failed.',
    });
    expect(response).not.toHaveProperty('description');
  });

  it('wraps rejected fetch calls in a structured error', async () => {
    const config = new ConfigService({
      NVIDIA_API_KEY: 'key',
      NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      NVIDIA_MODEL: 'deepseek-ai/deepseek-v4-flash',
    });
    const fetchMock = mockFetch();
    fetchMock.mockRejectedValue(new Error('network down'));

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
      NVIDIA_MODEL: 'deepseek-ai/deepseek-v4-flash',
    });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(new Response('not-json'));

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
      NVIDIA_MODEL: 'deepseek-ai/deepseek-v4-flash',
    });
    const fetchMock = mockFetch();
    fetchMock.mockImplementation((_url, init) => {
      if (!init?.signal) {
        return Promise.reject(new Error('Missing abort signal'));
      }

      const signal = init.signal;
      return new Promise<Response>((_resolve, reject) => {
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

function mockFetch(): FetchMock {
  const fetchMock = jest.fn<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >();
  global.fetch = fetchMock;
  return fetchMock;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function getLastFetchCall(
  fetchMock: FetchMock,
): [RequestInfo | URL, RequestInit] {
  const call = fetchMock.mock.calls[0];
  if (!call?.[1]) {
    throw new Error('Expected fetch to be called with options.');
  }
  return [call[0], call[1]];
}

function getFetchHeaders(init: RequestInit): Record<string, unknown> {
  if (!isRecord(init.headers)) {
    throw new Error('Expected fetch headers to be a plain object.');
  }
  return init.headers;
}

function parseJsonBody(init: RequestInit): unknown {
  if (typeof init.body !== 'string') {
    throw new Error('Expected fetch body to be a string.');
  }
  return JSON.parse(init.body) as unknown;
}

async function getErrorResponse(
  promise: Promise<unknown>,
): Promise<Record<string, unknown>> {
  try {
    await promise;
  } catch (error: unknown) {
    if (!hasGetResponse(error)) {
      throw error;
    }

    const response: unknown = error.getResponse();
    if (!isRecord(response)) {
      throw error;
    }
    return response;
  }

  throw new Error('Expected promise to reject.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasGetResponse(
  value: unknown,
): value is { getResponse: () => unknown } {
  return isRecord(value) && typeof value.getResponse === 'function';
}
