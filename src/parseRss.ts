import { cleanupBookTitle } from './cleanupBookTitle';
import { doError, doLog } from './logging';

export interface GoodreadsBook {
    bookId: string;
    title: string;
    author: string;
    coverUrl: string;
    dateAddedToShelf?: Date;
    averageRating?: number;
    userRating?: number;
    shelves: string[];
    yearPublished?: number;
    dateRead?: Date;
}

export interface ParseOptions {
    cleanupTitle: boolean;
}

export interface ParseResult {
    books: GoodreadsBook[];
    /** Number of feed items that could not be parsed */
    skipped: number;
}

function getItemProperty(item: Element, property: string): string {
    return item.getElementsByTagName(property)[0]?.textContent ?? '';
}

function parseDate(raw: string): Date | undefined {
    if (!raw) return undefined;
    const date = new Date(raw);
    return isNaN(date.getTime()) ? undefined : date;
}

function parseBook(item: Element, parseOptions: ParseOptions): GoodreadsBook|undefined {
       // A title is necessary
       let rawTitle = getItemProperty(item, 'title');
       if (!rawTitle) {
           doError(`Failed to parse title for item: ${item.textContent?.slice(0, 200)}`);
           return;
       }

       const title = parseOptions.cleanupTitle ? cleanupBookTitle(rawTitle) : rawTitle;

       const bookId = getItemProperty(item, 'book_id');

       const author = getItemProperty(item, 'author_name');

       const coverUrl = getItemProperty(item, 'book_image_url');

       const shelves = getItemProperty(item, 'user_shelves')
           .split(',')
           .map(shelf => shelf.trim())
           .filter(shelf => shelf.length > 0);

       const averageRatingRaw = getItemProperty(item, 'average_rating');
       const averageRating = averageRatingRaw ? parseFloat(averageRatingRaw) : undefined;

       const userRatingRaw = getItemProperty(item, 'user_rating');
       const userRating = userRatingRaw ? parseInt(userRatingRaw, 10) : undefined;

       const dateRead = parseDate(getItemProperty(item, 'user_read_at'));

       const dateAddedToShelf = parseDate(getItemProperty(item, 'user_date_added'));

       const yearPublishedRaw = getItemProperty(item, 'book_published');
       const yearPublished = yearPublishedRaw ? parseInt(yearPublishedRaw, 10) : undefined;


       return {
           bookId,
           title,
           author,
           coverUrl,
           dateAddedToShelf,
           averageRating,
           userRating,
           shelves,
           yearPublished,
           dateRead
       };
}

export function parseBooks(rssXml: Document, options: ParseOptions): ParseResult {
    doLog('Parsing books with options', options);
    const books: GoodreadsBook[] = [];
    let skipped = 0;

   // Get all book items from the feed
   const items = rssXml.getElementsByTagName('item');
   doLog(`Found ${items.length} book(s) in feed`);

   for(const item of items) {
    let book: GoodreadsBook | undefined;
    try {
        book = parseBook(item, options);
    } catch (error) {
        doError(`Failed to parse feed item: ${error}`);
    }
    if(!book) {
        skipped++;
        continue;
    }

    doLog('Parsed book', book);
    books.push(book);
   }

   return { books, skipped };
}
