import {
  isAllowedFrontendOrigin,
  parseFrontendOrigins,
  primaryFrontendOrigin,
} from './frontend-origins';

describe('frontend-origins', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('parses comma-separated FRONTEND_URL values', () => {
    process.env.NODE_ENV = 'development';
    process.env.FRONTEND_URL =
      'https://nuvela.space,https://nuvela.vercel.app';

    expect(parseFrontendOrigins()).toEqual([
      'https://nuvela.space',
      'https://nuvela.vercel.app',
    ]);
  });

  it('allows nuvela.space in production even when FRONTEND_URL is stale', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://nuvela-beryl.vercel.app';

    expect(isAllowedFrontendOrigin('https://nuvela.space')).toBe(true);
    expect(isAllowedFrontendOrigin('https://evil.example')).toBe(false);
  });

  it('prefers nuvela.space for email deep links when configured', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://nuvela-beryl.vercel.app';

    expect(primaryFrontendOrigin()).toBe('https://nuvela.space');
  });
});
