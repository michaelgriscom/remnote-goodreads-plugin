// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleRequest } from './worker';

const WORKER_URL = 'https://goodreads-cors-proxy.example.workers.dev/';
const FEED_URL = 'https://www.goodreads.com/review/list_rss/12345?key=abc&shelf=read';

function proxyRequest(target?: string, init?: RequestInit): Request {
  const url = target !== undefined ? `${WORKER_URL}?url=${encodeURIComponent(target)}` : WORKER_URL;
  return new Request(url, init);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('handleRequest', () => {
  it('answers preflight requests with CORS headers', async () => {
    const response = await handleRequest(proxyRequest(FEED_URL, { method: 'OPTIONS' }));

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('rejects non-GET methods', async () => {
    const response = await handleRequest(proxyRequest(FEED_URL, { method: 'POST' }));
    expect(response.status).toBe(405);
  });

  it('rejects a missing url parameter', async () => {
    const response = await handleRequest(proxyRequest());
    expect(response.status).toBe(400);
  });

  it('rejects non-Goodreads hosts', async () => {
    const response = await handleRequest(proxyRequest('https://example.com/review/list_rss/1'));
    expect(response.status).toBe(403);
  });

  it('rejects non-RSS Goodreads paths', async () => {
    const response = await handleRequest(proxyRequest('https://www.goodreads.com/user/show/1'));
    expect(response.status).toBe(403);
  });

  it('rejects plain-http URLs', async () => {
    const response = await handleRequest(proxyRequest('http://www.goodreads.com/review/list_rss/1'));
    expect(response.status).toBe(400);
  });

  it('proxies allowed feed URLs and adds CORS headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<rss><channel></channel></rss>', {
        status: 200,
        headers: { 'Content-Type': 'application/xml' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleRequest(proxyRequest(FEED_URL));

    expect(fetchMock).toHaveBeenCalledWith(FEED_URL, expect.anything());
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await response.text()).toBe('<rss><channel></channel></rss>');
  });

  it('passes through upstream error statuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })));

    const response = await handleRequest(proxyRequest(FEED_URL));

    expect(response.status).toBe(404);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
