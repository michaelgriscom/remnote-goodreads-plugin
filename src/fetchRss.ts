import { doLog } from "./logging";

function validateGoodreadsUrl(feedUrl: string): URL {
    let url: URL;
    try {
      url = new URL(feedUrl);
    } catch {
      throw new Error(`Invalid URL: "${feedUrl}"`);
    }

    if (url.hostname !== 'www.goodreads.com' && url.hostname !== 'goodreads.com') {
      throw new Error(`URL must be a Goodreads URL (goodreads.com), got: "${url.hostname}"`);
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error(`URL must use http or https protocol, got: "${url.protocol}"`);
    }

    return url;
}

/**
 * Build the request URL from a proxy template. A `{url}` placeholder is
 * replaced with the URL-encoded feed URL (e.g. allorigins:
 * `https://api.allorigins.win/raw?url={url}`); a template without the
 * placeholder gets the feed URL appended as-is (e.g. cors-anywhere:
 * `https://cors-anywhere.com/`).
 */
export function buildProxyUrl(template: string, feedUrl: URL): string {
    const trimmed = template.trim();
    if (!trimmed) {
      throw new Error('Proxy URL is enabled but empty; set it in the plugin settings');
    }
    const requestUrl = trimmed.includes('{url}')
      ? trimmed.replace('{url}', encodeURIComponent(feedUrl.toString()))
      : trimmed + feedUrl.toString();
    try {
      new URL(requestUrl);
    } catch {
      throw new Error(`Proxy setting does not produce a valid URL: "${requestUrl}"`);
    }
    return requestUrl;
}

export interface FetchRssOptions {
    /** Proxy URL template; when set, the feed is fetched through it */
    proxyTemplate?: string;
}

export async function fetchRss(feedUrl: string, options: FetchRssOptions = {}): Promise<Document> {
    const url = validateGoodreadsUrl(feedUrl);
    // Public shelves are readable without the per-user `key`, so drop it:
    // it keeps the private key out of every request, including any that
    // pass through a third-party relay. (Private profiles that require the
    // key are the tradeoff.)
    url.searchParams.delete('key');
    // Without a proxy, fetch the relative path handled by the webpack
    // dev-server proxy (see webpack.config.js)
    const requestUrl = options.proxyTemplate
      ? buildProxyUrl(options.proxyTemplate, url)
      : `/goodreads${url.pathname}${url.search}`;

    // Fetch and parse the RSS feed
    doLog(`Fetching from ${requestUrl}`);
    const response = await fetch(requestUrl, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Failed to fetch Goodreads feed: HTTP ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    // DOMParser reports XML errors by embedding a parsererror element instead of throwing
    if (doc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Goodreads feed is not valid XML; check that the feed URL is correct');
    }
    return doc;
}
