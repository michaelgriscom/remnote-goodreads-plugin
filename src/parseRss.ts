import { cleanupBookTitle } from './cleanupBookTitle';
import { doError, doLog } from './logging';

export interface GoodreadsBook {
    title: string;
    author: string;
    coverUrl: string;
    dateAddedToShelf?: Date;
    averageRating: number;
    userRating: number;
    shelves: string[];
    datePublished?: Date;
    dateRead?: Date;
}

export interface ParseOptions {
    cleanupTitle: boolean;
}

function parseBook(item: Element, parseOptions: ParseOptions): GoodreadsBook|undefined {
       // Extract book information
       let title = item.getElementsByTagName('title')[0].textContent;
       if (!title) {
           doError(`Failed to parse title for item: ${item}`);
           return;
       }
   
       if(parseOptions.cleanupTitle) {
           title = cleanupBookTitle(title);
       }
       
       const link = item.getElementsByTagName('link')[0].textContent;
       const description = item.getElementsByTagName('description')[0].textContent ?? '';
   
       // Parse description to extract additional details
       const parser = new DOMParser();
       const descDoc = parser.parseFromString(description, 'text/html');
   
       // Author extraction
       const authorMatch = description.match(/author: (.*?)<br/);
       const author = authorMatch ? authorMatch[1].trim() : '';
   
       // Cover URL extraction
       const imgElement = descDoc.querySelector('img');
       const coverUrl = imgElement ? imgElement.src : '';
   
       // Shelves extraction
       const shelvesMatch = description.match(/shelves: (.*?)</);
       const shelves = shelvesMatch 
           ? shelvesMatch[1].split(',').map(shelf => shelf.trim()) 
           : [];
   
       // Average Rating extraction
       const averageRatingMatch = description.match(/average rating: (\d+\.\d+)/);
       const averageRating = averageRatingMatch 
           ? parseFloat(averageRatingMatch[1]) 
           : 0;
   
       // User Rating extraction
       const userRatingMatch = description.match(/rating: (\d+)/);
       const userRating = userRatingMatch 
           ? parseInt(userRatingMatch[1], 10) 
           : 0;
   
       // Date Added to Shelf extraction
       const dateAddedMatch = description.match(/date added: (\w+ \d{1,2}, \d{4})/);
       const dateAddedToShelf = dateAddedMatch 
           ? new Date(dateAddedMatch[1]) 
           : undefined;
   
       // Date Read extraction
       const dateReadMatch = description.match(/read at: (\w+ \d{1,2}, \d{4})/);
       const dateRead = dateReadMatch 
           ? new Date(dateReadMatch[1]) 
           : undefined;
   
       // Publication Date extraction
       const pubDateMatch = description.match(/book published: (\w+ \d{1,2}, \d{4})/);
       const datePublished = pubDateMatch 
           ? new Date(pubDateMatch[1]) 
           : undefined;
   
       return {
           title,
           author,
           coverUrl,
           dateAddedToShelf,
           averageRating,
           userRating,
           shelves,
           datePublished,
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