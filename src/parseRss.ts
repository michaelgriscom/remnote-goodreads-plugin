import { cleanupBookTitle } from './cleanupBookTitle';
import { doError, doLog } from './logging';

export interface GoodreadsBook {
    title: string;
    author: string;
    coverUrl: string;
    dateAddedToShelf: Date;
    averageRating: number;
    userRating: number;
    shelves: string[];
    datePublished: Date;
    dateRead: Date;
}

export interface ParseOptions {
    cleanupTitle: boolean;
}

export function parseBook(item: Element, parseOptions: ParseOptions): GoodreadsBook|undefined {
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
  
      const authorMatch = description.match(/by (.*?)<br/);
      const author = authorMatch ? authorMatch[1].trim() : 'Unknown Author';
      const imgElement = descDoc.querySelector('img');
      const coverUrl = imgElement ? imgElement.src : '';

      return {
        title,
        author,
        coverUrl,
      };
}

export function parseBooks(rssXml: Document, options: ParseOptions): GoodreadsBook[] {
    const books: GoodreadsBook[] = [];

   // Get all book items from the feed
   const items = rssXml.getElementsByTagName('item');
   doLog(`Found ${items.length} book(s) in feed`);

    

    return books;
}