import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildProxyUrl, fetchRss } from './fetchRss';

const FEED_URL = 'https://www.goodreads.com/review/list_rss/12345?key=abc&shelf=read';
// The same feed with the private key stripped, as fetchRss sends it
const FEED_URL_NO_KEY = 'https://www.goodreads.com/review/list_rss/12345?shelf=read';

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

  it('fetches through the /goodreads proxy path with the key stripped', async () => {
    const fetchMock = mockFetchResponse('<rss><channel></channel></rss>');
    vi.stubGlobal('fetch', fetchMock);

    await fetchRss(FEED_URL);

    expect(fetchMock).toHaveBeenCalledWith(
      '/goodreads/review/list_rss/12345?shelf=read',
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

  it('fetches through the proxy template when provided', async () => {
    const fetchMock = mockFetchResponse('<rss><channel></channel></rss>');
    vi.stubGlobal('fetch', fetchMock);

    await fetchRss(FEED_URL, { proxyTemplate: 'https://foo-cors-proxy.test/raw?url={url}' });

    expect(fetchMock).toHaveBeenCalledWith(
      `https://foo-cors-proxy.test/raw?url=${encodeURIComponent(FEED_URL_NO_KEY)}`,
      expect.anything()
    );
  });

  it('strips the private key so it never reaches the relay', async () => {
    const fetchMock = mockFetchResponse('<rss><channel></channel></rss>');
    vi.stubGlobal('fetch', fetchMock);

    await fetchRss(FEED_URL, { proxyTemplate: 'https://foo-cors-proxy.test/raw?url={url}' });

    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestedUrl).not.toContain('key');
    expect(requestedUrl).not.toContain('abc');
  });

  it('still validates the feed URL when a proxy is used', async () => {
    await expect(
      fetchRss('https://example.com/feed', { proxyTemplate: 'https://proxy.test/{url}' })
    ).rejects.toThrow('must be a Goodreads URL');
  });
});

describe('buildProxyUrl', () => {
  const feedUrl = new URL(FEED_URL);

  it('replaces the {url} placeholder with the encoded feed URL', () => {
    expect(buildProxyUrl('https://foo-cors-proxy.test/raw?url={url}', feedUrl)).toBe(
      `https://foo-cors-proxy.test/raw?url=${encodeURIComponent(FEED_URL)}`
    );
  });

  it('appends the feed URL when the template has no placeholder', () => {
    expect(buildProxyUrl('https://foo-cors-proxy.test/', feedUrl)).toBe(
      `https://foo-cors-proxy.test/${FEED_URL}`
    );
  });

  it('rejects an empty template', () => {
    expect(() => buildProxyUrl('   ', feedUrl)).toThrow('empty');
  });

  it('rejects a template that produces an invalid URL', () => {
    expect(() => buildProxyUrl('not a url {url}', feedUrl)).toThrow('valid URL');
  });
});
