import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRss } from './fetchRss';

const FEED_URL = 'https://www.goodreads.com/review/list_rss/12345?key=abc&shelf=read';

function mockFetchResponse(body: string, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    text: () => Promise.resolve(body),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchRss', () => {
  it('rejects malformed URLs', async () => {
    await expect(fetchRss('not-a-url')).rejects.toThrow('Invalid URL');
  });

  it('rejects non-Goodreads hosts', async () => {
    await expect(fetchRss('https://example.com/feed')).rejects.toThrow(
      'must be a Goodreads URL'
    );
  });

  it('fetches through the /goodreads proxy path', async () => {
    const fetchMock = mockFetchResponse('<rss><channel></channel></rss>');
    vi.stubGlobal('fetch', fetchMock);

    await fetchRss(FEED_URL);

    expect(fetchMock).toHaveBeenCalledWith(
      '/goodreads/review/list_rss/12345?key=abc&shelf=read',
      expect.anything()
    );
  });

  it('throws on non-OK HTTP responses', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('Not Found', { ok: false, status: 404 }));

    await expect(fetchRss(FEED_URL)).rejects.toThrow('HTTP 404');
  });

  it('throws when the response is not valid XML', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('<html>definitely not < valid xml'));

    await expect(fetchRss(FEED_URL)).rejects.toThrow('not valid XML');
  });

  it('returns the parsed document for a valid feed', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponse('<rss><channel><item><title>Book</title></item></channel></rss>')
    );

    const doc = await fetchRss(FEED_URL);

    expect(doc.getElementsByTagName('item')).toHaveLength(1);
  });
});
