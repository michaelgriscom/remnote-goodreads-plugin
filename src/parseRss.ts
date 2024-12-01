import { cleanupBookTitle } from './cleanupBookTitle';
import { doError, doLog } from './logging';

export interface GoodreadsBook {
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

function getItemProperty(item: Element, property: string): string {
    return item.getElementsByTagName(property)[0].textContent ?? '';
}

function parseBook(item: Element, parseOptions: ParseOptions): GoodreadsBook|undefined {
       // A title is necessary
       let rawTitle = getItemProperty(item, 'title');
       if (!rawTitle) {
           doError(`Failed to parse title for item: ${item}`);
           return;
       }

       const title = parseOptions.cleanupTitle ? cleanupBookTitle(rawTitle) : rawTitle;
       
       const author = getItemProperty(item, 'author_name');
   
       const coverUrl = getItemProperty(item, 'book_image_url');
   
       const shelves = getItemProperty(item, 'user_shelves').split(',').map(shelf => shelf.trim()) ;
   
       const averageRatingRaw = getItemProperty(item, 'average_rating');
       const averageRating = averageRatingRaw ? parseFloat(averageRatingRaw) : undefined;
   
       const userRatingRaw = getItemProperty(item, 'user_rating');
       const userRating = userRatingRaw ? parseInt(userRatingRaw, 10) : undefined; 

       const dateReadRaw = getItemProperty(item, 'user_read_at');
       const dateRead = dateReadRaw ? new Date(dateReadRaw) : undefined;
   
       const dateAddedRaw = getItemProperty(item, 'user_date_added');
       const dateAddedToShelf = dateAddedRaw ? new Date(dateAddedRaw) : undefined;
   
       const yearPublishedRaw = getItemProperty(item, 'book_published');
       const yearPublished = yearPublishedRaw ? parseInt(yearPublishedRaw, 10) : undefined;
   
   
       return {
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

export function parseBooks(rssXml: Document, options: ParseOptions): GoodreadsBook[] {
    const books: GoodreadsBook[] = [];

   // Get all book items from the feed
   const items = rssXml.getElementsByTagName('item');
   doLog(`Found ${items.length} book(s) in feed`);

   for(const item of items) {
    const book = parseBook(item, options);
    if(!book) continue;

    doLog('Parsed book', book);
    books.push(book);
   }

   return books;
}