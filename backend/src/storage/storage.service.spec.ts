import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('builds a usable signed URL from the Supabase Storage REST response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        signedURL:
          '/object/sign/attachments/org-1/project-1/task-1/doc.pdf?token=abc',
      }),
    );
    const service = new StorageService(configService());

    await expect(
      service.createSignedUrl('org-1/project-1/task-1/doc.pdf', 300),
    ).resolves.toBe(
      'https://example.supabase.co/storage/v1/object/sign/attachments/org-1/project-1/task-1/doc.pdf?token=abc',
    );
  });
});

function configService(): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'SUPABASE_URL') return 'https://example.supabase.co';
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-service-role';
      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as unknown as ConfigService;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
