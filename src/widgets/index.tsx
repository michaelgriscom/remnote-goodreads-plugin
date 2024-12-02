import { declareIndexPlugin, ReactRNPlugin, Rem } from '@remnote/plugin-sdk';
import '../style.css';
import '../App.css';
import { doError, doLog } from '../logging';
import { GoodreadsBook, parseBooks } from '../parseRss';
import { fetchRss } from '../fetchRss';

async function createRemForBook({title}: GoodreadsBook, plugin: ReactRNPlugin): Promise<Rem|undefined> {
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
    const xmlDoc = await fetchRss(feedUrl);

    const cleanupTitle: boolean = await plugin.settings.getSetting('cleanupTitles');
    const books = parseBooks(xmlDoc, {cleanupTitle});
    doLog(`Found ${books.length} book(s) in feed`);

    // Process each book
    for (const book of books) {
      const rem = await createRemForBook(book, plugin);
      if(rem) remsCreated++;
    }

    await plugin.app.toast(`Goodreads sync complete. Found ${remsCreated} new book(s) (${books.length - remsCreated} existing)`);
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

  await plugin.settings.registerBooleanSetting({
    id: 'cleanupTitles',
    title: 'Simplify book titles',
    description: 'Omit information like subtitles, editions, etc. from book titles',
    defaultValue: true,
  })

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
