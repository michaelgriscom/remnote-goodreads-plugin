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
    const text = await response.text();
    const parser = new DOMParser();
    return parser.parseFromString(text, 'text/xml');
}