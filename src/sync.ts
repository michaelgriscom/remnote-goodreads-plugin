import { type RNPlugin, PluginRem, RichTextInterface } from '@remnote/plugin-sdk';
import { doError, doLog } from './logging';
import { GoodreadsBook, parseBooks } from './parseRss';
import { fetchRss } from './fetchRss';

const PARENT_REM_NAME = 'Goodreads Import';
const BOOKS_CONTAINER_NAME = 'Books';
const AUTHORS_CONTAINER_NAME = 'Authors';
const AUTHOR_TAG_NAME = 'Author';
const CURRENTLY_READING_NAME = 'Currently Reading';
const COMPLETED_NAME = 'Completed';

export const BOOK_POWERUP_CODE = 'goodreadsBook';
export const BOOK_POWERUP_SLOTS = {
  BOOK_ID: 'bookId',
  AUTHORS: 'authors',
  DATE_READ: 'dateRead',
  DATE_ADDED: 'dateAdded',
};

export const STORAGE_KEYS = {
  LAST_SYNC_TIME: 'goodreads-sync_last-sync-time',
  SYNC_STATUS: 'goodreads-sync_sync-status',
  SYNC_RESULT: 'goodreads-sync_sync-result',
};

export interface SyncResult {
  imported: number;
  existing: number;
  total: number;
  /** Number of feed items that could not be parsed */
  skipped: number;
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

async function getOrCreateChildRem(
  plugin: RNPlugin,
  name: string,
  parentId: string
): Promise<PluginRem> {
  const existingRem = await plugin.rem.findByName([name], parentId);
  if (existingRem) {
    doLog(`Rem "${name}" found (${existingRem._id})`);
    return existingRem;
  }

  const childRem = await plugin.rem.createRem();
  if (!childRem) {
    throw new Error(`Failed to create Rem "${name}"`);
  }
  await childRem.setText([name]);
  await childRem.setParent(parentId);
  doLog(`Rem "${name}" created (${childRem._id})`);
  return childRem;
}

async function ensureTagged(rem: PluginRem, tag: PluginRem): Promise<void> {
  const existingTags = await rem.getTagRems();
  if (!existingTags.some((t) => t._id === tag._id)) {
    await rem.addTag(tag);
  }
}

async function getOrCreateAuthorRem(
  plugin: RNPlugin,
  authorName: string,
  authorsContainerId: string,
  authorTag: PluginRem
): Promise<PluginRem> {
  const existingRem = await plugin.rem.findByName([authorName], authorsContainerId);
  if (existingRem) {
    doLog(`Author Rem "${authorName}" found (${existingRem._id})`);
    // Self-healing: if the Author tag rem was deleted and recreated,
    // re-tag existing authors on the next sync
    await ensureTagged(existingRem, authorTag);
    return existingRem;
  }

  const authorRem = await plugin.rem.createRem();
  if (!authorRem) {
    throw new Error(`Failed to create author Rem "${authorName}"`);
  }
  await authorRem.setText([authorName]);
  await authorRem.setIsDocument(true);
  await authorRem.setParent(authorsContainerId);
  await authorRem.addTag(authorTag);
  doLog(`Author Rem "${authorName}" created and tagged (${authorRem._id})`);
  return authorRem;
}

/**
 * Map every Rem carrying the book powerup by its stored Goodreads ID,
 * so syncs can upsert instead of relying on title matching.
 */
async function buildBookIndex(plugin: RNPlugin): Promise<Map<string, PluginRem>> {
  const index = new Map<string, PluginRem>();
  const powerup = await plugin.powerup.getPowerupByCode(BOOK_POWERUP_CODE);
  const taggedRems = (await powerup?.taggedRem()) ?? [];
  for (const rem of taggedRems) {
    const bookId = await rem.getPowerupProperty(BOOK_POWERUP_CODE, BOOK_POWERUP_SLOTS.BOOK_ID);
    if (bookId) {
      index.set(bookId, rem);
    }
  }
  doLog(`Found ${index.size} previously imported book(s)`);
  return index;
}

/**
 * Build a date property value as a reference to the date's daily
 * document, so the book shows up as a backlink on that date. Falls
 * back to plain text if the daily document can't be created or the
 * plugin's permission scope doesn't cover daily documents.
 */
async function dateProperty(plugin: RNPlugin, date: Date): Promise<RichTextInterface> {
  try {
    const dailyDoc = await plugin.date.getDailyDoc(date);
    if (dailyDoc) {
      return await plugin.richText.rem(dailyDoc).value();
    }
  } catch (error) {
    doLog(`Could not link daily document for date, storing as text: ${error}`);
  }
  return [date.toISOString().slice(0, 10)];
}

interface SyncContext {
  plugin: RNPlugin;
  booksContainerId: string;
  currentlyReadingId: string;
  completedId: string;
  authorsContainerId: string;
  authorTag: PluginRem;
  bookIndex: Map<string, PluginRem>;
}

async function findExistingBookRem(
  book: GoodreadsBook,
  { plugin, booksContainerId, currentlyReadingId, completedId, bookIndex }: SyncContext
): Promise<PluginRem | undefined> {
  if (book.bookId && bookIndex.has(book.bookId)) {
    return bookIndex.get(book.bookId);
  }
  // Fall back to title matching for rems imported before the
  // Goodreads ID was captured (or feed items without one)
  for (const parentId of [currentlyReadingId, completedId, booksContainerId]) {
    const byTitle = await plugin.rem.findByName([book.title], parentId);
    if (byTitle) return byTitle;
  }
  return undefined;
}

async function upsertBookRem(
  book: GoodreadsBook,
  context: SyncContext
): Promise<{ created: boolean }> {
  const { plugin, currentlyReadingId, completedId, authorsContainerId, authorTag } = context;
  const { bookId, title, author, dateRead, dateAddedToShelf } = book;

  // A book with a read date is completed; one without is in progress.
  // setParent also moves existing books between the groups when their
  // read state changes on Goodreads.
  const statusParentId = dateRead ? completedId : currentlyReadingId;

  let bookRem = await findExistingBookRem(book, context);
  const created = !bookRem;

  if (!bookRem) {
    doLog(`No rem for "${title}" found, creating`);
    const newRem = await plugin.rem.createRem();
    if (!newRem) {
      throw new Error(`Failed to create Rem "${title}"`);
    }
    await newRem.setText([title]);
    await newRem.setIsDocument(true);
    bookRem = newRem;
  } else {
    doLog(`Rem for "${title}" exists (${bookRem._id}), updating`);
  }
  await bookRem.setParent(statusParentId);

  // Idempotent: adding an already-present powerup is a no-op
  await bookRem.addPowerup(BOOK_POWERUP_CODE);

  if (bookId) {
    await bookRem.setPowerupProperty(BOOK_POWERUP_CODE, BOOK_POWERUP_SLOTS.BOOK_ID, [bookId]);
  }

  if (author) {
    const authorRem = await getOrCreateAuthorRem(plugin, author, authorsContainerId, authorTag);
    const authorRichText = await plugin.richText.rem(authorRem).value();
    await bookRem.setPowerupProperty(
      BOOK_POWERUP_CODE,
      BOOK_POWERUP_SLOTS.AUTHORS,
      authorRichText
    );
  }

  if (dateRead) {
    await bookRem.setPowerupProperty(
      BOOK_POWERUP_CODE,
      BOOK_POWERUP_SLOTS.DATE_READ,
      await dateProperty(plugin, dateRead)
    );
  }

  if (dateAddedToShelf) {
    await bookRem.setPowerupProperty(
      BOOK_POWERUP_CODE,
      BOOK_POWERUP_SLOTS.DATE_ADDED,
      await dateProperty(plugin, dateAddedToShelf)
    );
  }

  doLog(`Rem populated for "${title}" (${bookRem._id})`);
  return { created };
}

function formatSyncResult(result: SyncResult): string {
  let message = `Imported ${result.imported} new book(s) (${result.existing} already existed).`;
  if (result.skipped > 0) {
    message += ` ${result.skipped} feed item(s) could not be parsed.`;
  }
  return message;
}

/**
 * Runs a sync while reflecting its progress and outcome in the
 * session-storage status keys the sidebar widget renders from.
 * Returns the result, or undefined if the sync failed.
 */
export async function runSyncWithStatus(plugin: RNPlugin): Promise<SyncResult | undefined> {
  try {
    await plugin.storage.setSession(STORAGE_KEYS.SYNC_STATUS, 'syncing');
    await plugin.storage.setSession(STORAGE_KEYS.SYNC_RESULT, '');
    const result = await performSync(plugin);
    await plugin.storage.setSession(STORAGE_KEYS.SYNC_RESULT, formatSyncResult(result));
    await plugin.storage.setSession(STORAGE_KEYS.SYNC_STATUS, 'idle');
    return result;
  } catch (error) {
    doError(`Error syncing Goodreads shelf: ${error}`);
    const message = error instanceof Error ? error.message : String(error);
    await plugin.storage.setSession(STORAGE_KEYS.SYNC_RESULT, `Sync failed: ${message}`);
    await plugin.storage.setSession(STORAGE_KEYS.SYNC_STATUS, 'error');
    return undefined;
  }
}

export async function performSync(plugin: RNPlugin): Promise<SyncResult> {
  const feedUrl: string = await plugin.settings.getSetting('feedUrl');
  const xmlDoc = await fetchRss(feedUrl);

  const cleanupTitle: boolean = await plugin.settings.getSetting('cleanupTitles');
  const { books, skipped } = parseBooks(xmlDoc, { cleanupTitle });
  doLog(`Parsed ${books.length} book(s) from feed (${skipped} skipped)`);

  const parentRem = await getOrCreateParentRem(plugin);
  const booksContainer = await getOrCreateChildRem(plugin, BOOKS_CONTAINER_NAME, parentRem._id);
  const currentlyReading = await getOrCreateChildRem(
    plugin,
    CURRENTLY_READING_NAME,
    booksContainer._id
  );
  const completed = await getOrCreateChildRem(plugin, COMPLETED_NAME, booksContainer._id);
  const authorsContainer = await getOrCreateChildRem(
    plugin,
    AUTHORS_CONTAINER_NAME,
    parentRem._id
  );
  const authorTag = await getOrCreateChildRem(plugin, AUTHOR_TAG_NAME, parentRem._id);

  const context: SyncContext = {
    plugin,
    booksContainerId: booksContainer._id,
    currentlyReadingId: currentlyReading._id,
    completedId: completed._id,
    authorsContainerId: authorsContainer._id,
    authorTag,
    bookIndex: await buildBookIndex(plugin),
  };

  let imported = 0;
  for (const book of books) {
    try {
      const { created } = await upsertBookRem(book, context);
      if (created) imported++;
    } catch (error) {
      doError(`Failed to sync "${book.title}": ${error}`);
    }
  }

  await plugin.storage.setSynced(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toISOString());

  return {
    imported,
    existing: books.length - imported,
    total: books.length,
    skipped,
  };
}
