import { declareIndexPlugin, type ReactRNPlugin, Rem } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css'; // import <widget-name>.css
import { doError, doLog } from '../logging';
import { GoodreadsBook, parseBooks } from '../parseRss';
import { fetchRss } from '../fetchRss';

const PARENT_REM_NAME = 'Goodreads Import';
const BOOK_TAG_NAME = 'Book';
const AUTHOR_TAG_NAME = 'Author';
const AUTHORS_PROPERTY_NAME = 'Author(s)';

async function getOrCreateParentRem(plugin: ReactRNPlugin): Promise<Rem> {
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
  plugin: ReactRNPlugin,
  tagName: string,
  parentId: string
): Promise<Rem> {
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

async function getOrCreateSlotRem(
  plugin: ReactRNPlugin,
  slotName: string,
  tagId: string
): Promise<Rem> {
    const existingRem = await plugin.rem.findByName([slotName], tagId);
    if (existingRem) {
      doLog(`Slot Rem "${slotName}" found (${existingRem._id})`);
      return existingRem;
    }

    const slotRem = await plugin.rem.createRem();
    if (!slotRem) {
      throw new Error(`Failed to create slot Rem "${slotName}"`);
    }
    await slotRem.setText([slotName]);
    await slotRem.setParent(tagId);
    await slotRem.setIsSlot(true);
    doLog(`Slot Rem "${slotName}" created (${slotRem._id})`);
    return slotRem;
}

async function getOrCreateAuthorRem(
  plugin: ReactRNPlugin,
  authorName: string,
  parentId: string,
  authorTag: Rem
): Promise<Rem> {
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
  plugin: ReactRNPlugin;
  parentId: string;
  bookTag: Rem;
  authorTag: Rem;
  authorsSlot: Rem;
}

async function createRemForBook(
  book: GoodreadsBook,
  { plugin, parentId, bookTag, authorTag, authorsSlot }: CreateBookOptions
): Promise<Rem|undefined> {
    const { title, author } = book;

    // Check if a Rem with this title already exists under the parent
    const existingRem = await plugin.rem.findByName([title], parentId);
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
    await bookRem.setParent(parentId);

    // Tag the book with the "Book" tag
    await bookRem.addTag(bookTag);
    doLog(`Rem tagged as Book for "${title}" (${bookRem._id})`);

    // Create/find author and set the Author(s) property on the book
    if (author) {
      const authorRem = await getOrCreateAuthorRem(plugin, author, parentId, authorTag);

      // Create a property child on the book: text references the slot, back text references the author
      const propertyRem = await plugin.rem.createRem();
      if (propertyRem) {
        const slotRef = await plugin.richText.rem(authorsSlot).value();
        await propertyRem.setText(slotRef);
        const authorRef = await plugin.richText.rem(authorRem).value();
        await propertyRem.setBackText(authorRef);
        await propertyRem.setParent(bookRem._id);
        doLog(`Author "${author}" linked to "${title}"`);
      }
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

    const parentRem = await getOrCreateParentRem(plugin);

    // Create/find tag Rems and the Author(s) slot on the Book tag
    const bookTag = await getOrCreateTagRem(plugin, BOOK_TAG_NAME, parentRem._id);
    const authorTag = await getOrCreateTagRem(plugin, AUTHOR_TAG_NAME, parentRem._id);
    const authorsSlot = await getOrCreateSlotRem(plugin, AUTHORS_PROPERTY_NAME, bookTag._id);

    // Process each book
    for (const book of books) {
      const rem = await createRemForBook(book, {
        plugin,
        parentId: parentRem._id,
        bookTag,
        authorTag,
        authorsSlot,
      });
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
