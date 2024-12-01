import { declareIndexPlugin, ReactRNPlugin, Rem } from '@remnote/plugin-sdk';
import '../style.css';
import '../App.css';
import { doError, doLog } from '../logging';
import { cleanupBookTitle } from '../cleanupBookTitle';

async function createRemForRssItem(item: Element, plugin: ReactRNPlugin): Promise<Rem|undefined> {
    // Extract book information
    let title = item.getElementsByTagName('title')[0].textContent;
    if (!title) {
      doError(`Failed to parse title for item: ${item}`);
      return;
    }

    title = cleanupBookTitle(title);
    const link = item.getElementsByTagName('link')[0].textContent;
    const description = item.getElementsByTagName('description')[0].textContent ?? '';

    // Parse description to extract additional details
    const parser = new DOMParser();
    const descDoc = parser.parseFromString(description, 'text/html');

    // Check if a Rem with this title already exists
    const existingRem = await plugin.rem.findByName([title], null);
    if (existingRem) {
      doLog(`Rem for "${title}" exists (${existingRem._id}), skipping`);
      return;
    } else {
      doLog(`No rem for "${title}" found, creating`);
    }

    // Create new Rem for the book
    const bookRem = await plugin.rem.createRem();
    if (bookRem) {
      doLog(`Rem created for "${title}" (${bookRem._id})`);
    }
    if (!bookRem) {
      doError(`Failed to create Rem "${title}"`);
      return;
    }
    await bookRem.setText([title]);
    await bookRem.setIsDocument(true);

    doLog(`Rem populated for "${title}" (${bookRem._id})`);
    return bookRem;
}

async function fetchGoodreads(plugin: ReactRNPlugin) {
  let remsCreated = 0;
  try {
    // TODO: validate that the feedURL is a goodreads URL
    const feedUrl: string = await plugin.settings.getSetting('feedUrl');
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
    const xmlDoc = parser.parseFromString(text, 'text/xml');

    // Get all book items from the feed
    const items = xmlDoc.getElementsByTagName('item');
    doLog(`Found ${items.length} book(s) in feed`);

    // Process each book
    for (const item of items) {
      const rem = await createRemForRssItem(item, plugin);
      if(rem) remsCreated++;
    }

    await plugin.app.toast(`Goodreads sync complete. Found ${remsCreated} new book(s) (${items.length - remsCreated} existing)`);
  } catch (error) {
    doError(`Error fetching Goodreads shelf: ${error}`);
    await plugin.app.toast('Error syncing Goodreads, check the console for additional details.');
  }
}

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerStringSetting({
    id: 'feedUrl',
    title: 'Goodreads RSS feed',
  });

  // Register a command to fetch books from Goodreads
  await plugin.app.registerCommand({
    id: 'fetch-goodreads-shelf',
    name: 'Fetch Books from Goodreads Shelf',
    action: async () => {
      await fetchGoodreads(plugin);
    }
  });
}

async function onDeactivate(_: ReactRNPlugin) { }

declareIndexPlugin(onActivate, onDeactivate);
