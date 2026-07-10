import { describe, expect, it } from 'vitest';
import { parseBooks } from './parseRss';

function makeDoc(itemsXml: string): Document {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test shelf</title>${itemsXml}</channel></rss>`;
  return new DOMParser().parseFromString(xml, 'text/xml');
}

const fullItem = `
<item>
  <title>The Pragmatic Programmer: Your Journey to Mastery</title>
  <book_id>4099</book_id>
  <author_name>Andrew Hunt</author_name>
  <book_image_url>https://example.test/cover.jpg</book_image_url>
  <user_shelves>currently-reading, programming</user_shelves>
  <average_rating>4.32</average_rating>
  <user_rating>5</user_rating>
  <user_read_at>Tue, 05 Mar 2024 00:00:00 -0800</user_read_at>
  <user_date_added>Mon, 01 Jan 2024 12:30:00 -0800</user_date_added>
  <book_published>1999</book_published>
</item>`;

describe('parseBooks', () => {
  it('parses a complete feed item', () => {
    const { books, skipped } = parseBooks(makeDoc(fullItem), { cleanupTitle: false });

    expect(skipped).toBe(0);
    expect(books).toHaveLength(1);
    const book = books[0];
    expect(book.title).toBe('The Pragmatic Programmer: Your Journey to Mastery');
    expect(book.bookId).toBe('4099');
    expect(book.author).toBe('Andrew Hunt');
    expect(book.coverUrl).toBe('https://example.test/cover.jpg');
    expect(book.shelves).toEqual(['currently-reading', 'programming']);
    expect(book.averageRating).toBeCloseTo(4.32);
    expect(book.userRating).toBe(5);
    expect(book.yearPublished).toBe(1999);
    expect(book.dateRead?.toISOString()).toBe('2024-03-05T08:00:00.000Z');
    expect(book.dateAddedToShelf?.toISOString()).toBe('2024-01-01T20:30:00.000Z');
  });

  it('cleans up the title when the option is enabled', () => {
    const { books } = parseBooks(makeDoc(fullItem), { cleanupTitle: true });
    expect(books[0].title).toBe('The Pragmatic Programmer');
  });

  it('does not throw when optional tags are missing', () => {
    const { books, skipped } = parseBooks(
      makeDoc('<item><title>Bare Book</title></item>'),
      { cleanupTitle: false }
    );

    expect(skipped).toBe(0);
    expect(books).toHaveLength(1);
    const book = books[0];
    expect(book.title).toBe('Bare Book');
    expect(book.bookId).toBe('');
    expect(book.author).toBe('');
    expect(book.shelves).toEqual([]);
    expect(book.averageRating).toBeUndefined();
    expect(book.userRating).toBeUndefined();
    expect(book.yearPublished).toBeUndefined();
    expect(book.dateRead).toBeUndefined();
    expect(book.dateAddedToShelf).toBeUndefined();
  });

  it('skips items without a title and keeps the rest', () => {
    const { books, skipped } = parseBooks(
      makeDoc(`<item><author_name>No Title</author_name></item>${fullItem}`),
      { cleanupTitle: false }
    );

    expect(skipped).toBe(1);
    expect(books).toHaveLength(1);
    expect(books[0].bookId).toBe('4099');
  });

  it('parses an empty shelf list as no shelves', () => {
    const { books } = parseBooks(
      makeDoc('<item><title>Book</title><user_shelves></user_shelves></item>'),
      { cleanupTitle: false }
    );
    expect(books[0].shelves).toEqual([]);
  });

  it('treats unparseable dates as absent', () => {
    const { books } = parseBooks(
      makeDoc('<item><title>Book</title><user_read_at>not a date</user_read_at></item>'),
      { cleanupTitle: false }
    );
    expect(books[0].dateRead).toBeUndefined();
  });

  it('returns nothing for a feed without items', () => {
    const { books, skipped } = parseBooks(makeDoc(''), { cleanupTitle: false });
    expect(books).toEqual([]);
    expect(skipped).toBe(0);
  });
});
