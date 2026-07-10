import { type RNPlugin, PluginRem } from '@remnote/plugin-sdk';
import { doError, doLog } from './logging';
import { GoodreadsBook, parseBooks } from './parseRss';
import { fetchRss } from './fetchRss';

const PARENT_REM_NAME = 'Goodreads Import';
const BOOK_TAG_NAME = 'Book';
const AUTHOR_TAG_NAME = 'Author';
const AUTHORS_PROPERTY_NAME = 'Author(s)';

export const STORAGE_KEYS = {
  LAST_SYNC_TIME: 'goodreads-sync_last-sync-time',
  SYNC_STATUS: 'goodreads-sync_sync-status',
  SYNC_RESULT: 'goodreads-sync_sync-result',
};

export interface SyncResult {
  imported: number;
  existing: number;
  total: number;
}

async function getOrCreateParentRem(plugin: RNPlugin): Promise<PluginRem> {
  const existingRem = await plugin.rem.findByName([PARENT_REM_NAME], null);
  if (existingRem) {
    doLog(`Parent Rem "${PARENT_REM_NAME}" found (${existingRem._id})`);
    return existingRem;
  }

  const parentRem = await plugin.rem.createRem();
  if (!parentRem) {
    throw new Error(`Failed to create parent Rem "${PARENT_REM_NAME}"`);
  }
  await parentRem.setText([PARENT_REM_NAME]);
  await parentRem.setIsDocument(true);
  doLog(`Parent Rem "${PARENT_REM_NAME}" created (${parentRem._id})`);
  return parentRem;
}

async function getOrCreateTagRem(
  plugin: RNPlugin,
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
  plugin: RNPlugin,
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

async function getOrCreateAuthorRem(
  plugin: RNPlugin,
  authorName: string,
  parentId: string,
  authorTag: PluginRem
): Promise<PluginRem> {
  const existingRem = await plugin.rem.findByName([authorName], parentId);
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
  await authorRem.setParent(parentId);
  await authorRem.addTag(authorTag);
  doLog(`Author Rem "${authorName}" created and tagged (${authorRem._id})`);
  return authorRem;
}

interface CreateBookOptions {
  plugin: RNPlugin;
  parentId: string;
  bookTag: PluginRem;
  authorTag: PluginRem;
  authorsPropertyId: string;
}

async function createRemForBook(
  book: GoodreadsBook,
  { plugin, parentId, bookTag, authorTag, authorsPropertyId }: CreateBookOptions
): Promise<PluginRem | undefined> {
  const { title, author } = book;

  const existingRem = await plugin.rem.findByName([title], parentId);
  if (existingRem) {
    doLog(`Rem for "${title}" exists (${existingRem._id}), skipping`);
    return;
  } else {
    doLog(`No rem for "${title}" found, creating`);
  }

  const bookRem = await plugin.rem.createRem();
  if (!bookRem) {
    doError(`Failed to create Rem "${title}"`);
    return;
  }
  doLog(`Rem created for "${title}" (${bookRem._id})`);
  await bookRem.setText([title]);
  await bookRem.setIsDocument(true);
  await bookRem.setParent(parentId);

  await bookRem.addTag(bookTag);
  doLog(`Rem tagged as Book for "${title}" (${bookRem._id})`);

  if (author) {
    const authorRem = await getOrCreateAuthorRem(plugin, author, parentId, authorTag);
    const authorRichText = await plugin.richText.rem(authorRem).value();
    await bookRem.setTagPropertyValue(authorsPropertyId, authorRichText);
    doLog(`Author "${author}" linked to "${title}"`);
  }

  doLog(`Rem populated for "${title}" (${bookRem._id})`);
  return bookRem;
}

export async function performSync(plugin: RNPlugin): Promise<SyncResult> {
  const feedUrl: string = await plugin.settings.getSetting('feedUrl');
  const xmlDoc = await fetchRss(feedUrl);

  const cleanupTitle: boolean = await plugin.settings.getSetting('cleanupTitles');
  const books = parseBooks(xmlDoc, { cleanupTitle });
  doLog(`Found ${books.length} book(s) in feed`);

  const parentRem = await getOrCreateParentRem(plugin);

  const bookTag = await getOrCreateTagRem(plugin, BOOK_TAG_NAME, parentRem._id);
  const authorTag = await getOrCreateTagRem(plugin, AUTHOR_TAG_NAME, parentRem._id);

  const authorsProperty = await getOrCreateAuthorPropertyRem(plugin, bookTag);

  let imported = 0;
  for (const book of books) {
    const rem = await createRemForBook(book, {
      plugin,
      parentId: parentRem._id,
      bookTag,
      authorTag,
      authorsPropertyId: authorsProperty._id,
    });
    if (rem) imported++;
  }

  await plugin.storage.setSynced(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toISOString());

  return {
    imported,
    existing: books.length - imported,
    total: books.length,
  };
}
