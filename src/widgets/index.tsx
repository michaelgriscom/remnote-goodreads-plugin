import {
  declareIndexPlugin,
  type ReactRNPlugin,
  PluginRem,
} from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css'; // import <widget-name>.css
import { doError, doLog } from '../logging';
import { GoodreadsBook, parseBooks } from '../parseRss';
import { fetchRss } from '../fetchRss';

const PARENT_REM_NAME = 'Goodreads Import';
const BOOKS_CATEGORY_NAME = 'Books';
const AUTHORS_CATEGORY_NAME = 'Authors';
const BOOK_TAG_NAME = 'Book';
const AUTHOR_TAG_NAME = 'Author';
const AUTHORS_PROPERTY_NAME = 'Author(s)';

async function getOrCreateRem(
  plugin: ReactRNPlugin,
  name: string,
  parentId: string | null,
  isDocument: boolean = true
): Promise<PluginRem> {
    const existingRem = await plugin.rem.findByName([name], parentId);
    if (existingRem) {
      doLog(`Rem "${name}" found (${existingRem._id})`);
      return existingRem;
    }

    const rem = await plugin.rem.createRem();
    if (!rem) {
      throw new Error(`Failed to create Rem "${name}"`);
    }
    await rem.setText([name]);
    await rem.setIsDocument(isDocument);
    if (parentId) {
      await rem.setParent(parentId);
    }
    doLog(`Rem "${name}" created (${rem._id})`);
    return rem;
}

async function getOrCreateTagRem(
  plugin: ReactRNPlugin,
  tagName: string,
  parentId: string
): Promise<PluginRem> {
    const existingRem = await plugin.rem.findByName([tagName], parentId);
    if (existingRem) {
      doLog(`Tag Rem "${tagName}" found (${existingRem._id})`);
      return existingRem;
    }

    const tagRem = await plugin.rem.createRem();
    if (!tagRem) {
      throw new Error(`Failed to create tag Rem "${tagName}"`);
    }
    await tagRem.setText([tagName]);
    await tagRem.setParent(parentId);
    doLog(`Tag Rem "${tagName}" created (${tagRem._id})`);
    return tagRem;
}

async function getOrCreateAuthorPropertyRem(
  plugin: ReactRNPlugin,
  bookTag: PluginRem
): Promise<PluginRem> {
    const existingRem = await plugin.rem.findByName([AUTHORS_PROPERTY_NAME], bookTag._id);
    if (existingRem) {
      doLog(`Author(s) property found (${existingRem._id})`);
      return existingRem;
    }

    const propertyRem = await plugin.rem.createRem();
    if (!propertyRem) {
      throw new Error(`Failed to create Author(s) property Rem`);
    }
    await propertyRem.setText([AUTHORS_PROPERTY_NAME]);
    await propertyRem.setParent(bookTag._id);
    await propertyRem.setIsProperty(true);
    doLog(`Author(s) property created (${propertyRem._id})`);
    return propertyRem;
}

interface SyncContext {
  plugin: ReactRNPlugin;
  booksParentId: string;
  authorsParentId: string;
  bookTag: PluginRem;
  authorTag: PluginRem;
  authorsPropertyId: string;
}

async function getOrCreateAuthorRem(
  authorName: string,
  { plugin, authorsParentId, authorTag }: SyncContext
): Promise<PluginRem> {
    const existingRem = await plugin.rem.findByName([authorName], authorsParentId);
    if (existingRem) {
      doLog(`Author Rem "${authorName}" found (${existingRem._id})`);
      return existingRem;
    }

    const authorRem = await plugin.rem.createRem();
    if (!authorRem) {
      throw new Error(`Failed to create author Rem "${authorName}"`);
    }
    await authorRem.setText([authorName]);
    await authorRem.setIsDocument(true);
    await authorRem.setParent(authorsParentId);
    await authorRem.addTag(authorTag);
    doLog(`Author Rem "${authorName}" created and tagged (${authorRem._id})`);
    return authorRem;
}

async function createRemForBook(
  book: GoodreadsBook,
  ctx: SyncContext
): Promise<PluginRem|undefined> {
    const { title, author } = book;
    const { plugin, booksParentId, bookTag, authorsPropertyId } = ctx;

    // Check if a Rem with this title already exists under the books category
    const existingRem = await plugin.rem.findByName([title], booksParentId);
    if (existingRem) {
      doLog(`Rem for "${title}" exists (${existingRem._id}), skipping`);
      return;
    } else {
      doLog(`No rem for "${title}" found, creating`);
    }

    // Create new Rem for the book
    const bookRem = await plugin.rem.createRem();
    if (!bookRem) {
      doError(`Failed to create Rem "${title}"`);
      return;
    }
    doLog(`Rem created for "${title}" (${bookRem._id})`);
    await bookRem.setText([title]);
    await bookRem.setIsDocument(true);
    await bookRem.setParent(booksParentId);

    // Tag the book with the "Book" tag
    await bookRem.addTag(bookTag);
    doLog(`Rem tagged as Book for "${title}" (${bookRem._id})`);

    // Create/find author and set the Author(s) property
    if (author) {
      const authorRem = await getOrCreateAuthorRem(author, ctx);
      const authorRichText = await plugin.richText.rem(authorRem).value();
      await bookRem.setTagPropertyValue(authorsPropertyId, authorRichText);
      doLog(`Author "${author}" linked to "${title}"`);
    }

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

    const parentRem = await getOrCreateRem(plugin, PARENT_REM_NAME, null);
    const booksCategory = await getOrCreateRem(plugin, BOOKS_CATEGORY_NAME, parentRem._id);
    const authorsCategory = await getOrCreateRem(plugin, AUTHORS_CATEGORY_NAME, parentRem._id);

    // Create/find tag Rems
    const bookTag = await getOrCreateTagRem(plugin, BOOK_TAG_NAME, parentRem._id);
    const authorTag = await getOrCreateTagRem(plugin, AUTHOR_TAG_NAME, parentRem._id);

    // Create/find the Author(s) property on the Book tag
    const authorsProperty = await getOrCreateAuthorPropertyRem(plugin, bookTag);

    const ctx: SyncContext = {
      plugin,
      booksParentId: booksCategory._id,
      authorsParentId: authorsCategory._id,
      bookTag,
      authorTag,
      authorsPropertyId: authorsProperty._id,
    };

    // Process each book
    for (const book of books) {
      const rem = await createRemForBook(book, ctx);
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
