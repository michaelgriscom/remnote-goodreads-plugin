import { doLog } from "./logging";

export async function fetchRss(feedUrl: string): Promise<Document> {
    const proxyUrl = `/goodreads${new URL(feedUrl).pathname}${new URL(feedUrl).search}`;

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