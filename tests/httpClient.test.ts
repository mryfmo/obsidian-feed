import { describe, it, expect, vi } from 'vitest';
import { createHttpClient } from '../src/network/httpClient';

// Helper response mock
function mockResponse(body: string) {
  return {
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(body),
    headers: new Headers(),
  };
}

describe('corsAdapter', () => {
  it('proxies https requests via jina with correct encoding', async () => {
    const instance = createHttpClient();
    instance.defaults.adapter = vi.fn().mockRejectedValue({
      message: 'Network Error',
      config: { url: 'https://example.com' },
    });

    const fetchMock = vi.fn().mockResolvedValue(mockResponse('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const resp = await instance.get('https://example.com');
    expect(resp.data).toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://r.jina.ai/https%3A%2F%2Fexample.com',
      { method: 'GET' },
    );
  });
});
