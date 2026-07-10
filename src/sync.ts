import { type RNPlugin, PluginRem, RichTextInterface } from '@remnote/plugin-sdk';
import { doError, doLog } from './logging';
import { GoodreadsBook, parseBooks } from './parseRss';
import { fetchRss } from './fetchRss';

const PARENT_REM_NAME = 'Goodreads Import';
const CURRENTLY_READING_NAME = 'Currently Reading';
const COMPLETED_NAME = 'Completed';
const AUTHOR_SECTION_NAME = 'Author';

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
  BOOK_REM_MAP: 'goodreads-sync_book-rem-map',
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

/**
 * Find a direct child by its plain-text content. More reliable than
 * findByName, which can miss rems and cause duplicate sections (and
 * books seemingly vanishing into them) on re-sync.
 */
async function findChildByText(
  plugin: RNPlugin,
  parent: PluginRem,
  name: string
): Promise<PluginRem | undefined> {
  const children = await parent.getChildrenRem();
  for (const child of children) {
    if (!child.text) continue;
    try {
      if ((await plugin.richText.toString(child.text)) === name) {
        return child;
      }
    } catch {
      // Skip children with unparsable text
    }
  }
  return undefined;
}

interface SectionOptions {
  /** Insert a blank rem before the section for visual separation */
  separatorBefore?: boolean;
}

async function getOrCreateSection(
  plugin: RNPlugin,
  parent: PluginRem,
  name: string,
  { separatorBefore = false }: SectionOptions = {}
): Promise<PluginRem> {
  const existing = await findChildByText(plugin, parent, name);
  if (existing) {
    doLog(`Section "${name}" found (${existing._id})`);
    return existing;
  }

  if (separatorBefore) {
    const separator = await plugin.rem.createRem();
    if (separator) {
      await separator.setParent(parent._id);
    }
  }

  const section = await plugin.rem.createRem();
  if (!section) {
    throw new Error(`Failed to create section "${name}"`);
  }
  await section.setText([name]);
  await section.setParent(parent._id);
  await section.setFontSize('H2');
  doLog(`Section "${name}" created (${section._id})`);
  return section;
}

async function ensureTagged(rem: PluginRem, tag: PluginRem): Promise<void> {
  const existingTags = await rem.getTagRems();
  if (!existingTags.some((t) => t._id === tag._id)) {
    await rem.addTag(tag);
  }
}

/**
 * The "Author" section rem doubles as the tag for author rems, so the
 * Author(s) multi-select property can use it as its option source.
 */
async function getOrCreateAuthorRem(
  plugin: RNPlugin,
  authorName: string,
  authorSection: PluginRem
): Promise<PluginRem> {
  const existingRem = await findChildByText(plugin, authorSection, authorName);
  if (existingRem) {
    doLog(`Author Rem "${authorName}" found (${existingRem._id})`);
    await ensureTagged(existingRem, authorSection);
    return existingRem;
  }

  const authorRem = await plugin.rem.createRem();
  if (!authorRem) {
    throw new Error(`Failed to create author Rem "${authorName}"`);
  }
  await authorRem.setText([authorName]);
  await authorRem.setIsDocument(true);
  await authorRem.setParent(authorSection._id);
  await authorRem.addTag(authorSection);
  doLog(`Author Rem "${authorName}" created and tagged (${authorRem._id})`);
  return authorRem;
}

/**
 * bookId → remId map persisted in synced storage. This is the primary
 * dedup mechanism; enumerating powerup-tagged rems is the fallback.
 */
async function getBookRemMap(plugin: RNPlugin): Promise<Record<string, string>> {
  return (await plugin.storage.getSynced<Record<string, string>>(STORAGE_KEYS.BOOK_REM_MAP)) || {};
}

async function saveBookRemMap(plugin: RNPlugin, map: Record<string, string>): Promise<void> {
  await plugin.storage.setSynced(STORAGE_KEYS.BOOK_REM_MAP, map);
}

/**
 * Map every Rem carrying the book powerup by its stored Goodreads ID.
 * Fallback for books imported before the storage map existed.
 */
async function buildBookIndex(plugin: RNPlugin): Promise<Map<string, PluginRem>> {
  const index = new Map<string, PluginRem>();
  try {
    const powerup = await plugin.powerup.getPowerupByCode(BOOK_POWERUP_CODE);
    const taggedRems = (await powerup?.taggedRem()) ?? [];
    for (const rem of taggedRems) {
      const bookId = await rem.getPowerupProperty(BOOK_POWERUP_CODE, BOOK_POWERUP_SLOTS.BOOK_ID);
      if (bookId) {
        index.set(bookId, rem);
      }
    }
  } catch (error) {
    doError(`Failed to enumerate powerup-tagged books: ${error}`);
  }
  doLog(`Found ${index.size} previously imported book(s) via powerup`);
  return index;
}

/**
 * Build a date property value as a reference to the date's daily
 * document, so the book shows up as a backlink on that date. Falls
 * back to plain text if the daily document can't be created.
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
  currentlyReading: PluginRem;
  completed: PluginRem;
  authorSection: PluginRem;
  bookRemMap: Record<string, string>;
  bookIndex: Map<string, PluginRem>;
}

async function findExistingBookRem(
  book: GoodreadsBook,
  { plugin, currentlyReading, completed, bookRemMap, bookIndex }: SyncContext
): Promise<PluginRem | undefined> {
  if (book.bookId) {
    const mappedRemId = bookRemMap[book.bookId];
    if (mappedRemId) {
      const rem = await plugin.rem.findOne(mappedRemId);
      if (rem) return rem;
    }
    if (bookIndex.has(book.bookId)) {
      return bookIndex.get(book.bookId);
    }
  }
  // Fall back to title matching for rems without a tracked id
  for (const section of [currentlyReading, completed]) {
    const byTitle = await findChildByText(plugin, section, book.title);
    if (byTitle) return byTitle;
  }
  return undefined;
}

async function upsertBookRem(
  book: GoodreadsBook,
  context: SyncContext
): Promise<{ created: boolean }> {
  const { plugin, currentlyReading, completed, authorSection, bookRemMap } = context;
  const { bookId, title, author, dateRead, dateAddedToShelf } = book;

  // A book with a read date is completed; one without is in progress.
  // setParent also moves existing books between the groups when their
  // read state changes on Goodreads.
  const statusParent = dateRead ? completed : currentlyReading;

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
  await bookRem.setParent(statusParent._id);

  // Idempotent: adding an already-present powerup is a no-op
  await bookRem.addPowerup(BOOK_POWERUP_CODE);

  if (bookId) {
    await bookRem.setPowerupProperty(BOOK_POWERUP_CODE, BOOK_POWERUP_SLOTS.BOOK_ID, [bookId]);
    bookRemMap[bookId] = bookRem._id;
  }

  if (author) {
    const authorRem = await getOrCreateAuthorRem(plugin, author, authorSection);
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
  const currentlyReading = await getOrCreateSection(plugin, parentRem, CURRENTLY_READING_NAME);
  const completed = await getOrCreateSection(plugin, parentRem, COMPLETED_NAME);
  const authorSection = await getOrCreateSection(plugin, parentRem, AUTHOR_SECTION_NAME, {
    separatorBefore: true,
  });

  const context: SyncContext = {
    plugin,
    currentlyReading,
    completed,
    authorSection,
    bookRemMap: await getBookRemMap(plugin),
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

  await saveBookRemMap(plugin, context.bookRemMap);
  await plugin.storage.setSynced(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toISOString());

  return {
    imported,
    existing: books.length - imported,
    total: books.length,
    skipped,
  };
}
