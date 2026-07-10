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

export async function fetchRss(feedUrl: string): Promise<Document> {
    const url = validateGoodreadsUrl(feedUrl);
    const proxyUrl = `/goodreads${url.pathname}${url.search}`;

    // Fetch and parse the RSS feed
    doLog(`Fetching from ${proxyUrl}`);
    const response = await fetch(proxyUrl,
      {
        mode: 'cors',
        headers: {
          'Content-Type': 'application/xml',
        }
      }
    );
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
