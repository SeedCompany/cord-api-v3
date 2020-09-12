import { random } from 'lodash';
import { books } from './books';
import { ScriptureRange, ScriptureRangeInput, ScriptureReference } from './dto';

interface VerseRange {
  start: number;
  end: number;
}

export const scriptureToVerseRange = (
  scriptureRange: ScriptureRange
): VerseRange => {
  const start = toVerseId(scriptureRange.start.book, scriptureRange.start);
  const end = toVerseId(scriptureRange.start.book, scriptureRange.end);

  return {
    start,
    end,
  };
};
const toVerseId = (
  bookName: string,
  scriptureRangePart: ScriptureReference
): number => {
  let verseCount = 0;
  // 1. grab all verses in Bible before current book
  // 2. grab all verses in chapters up to current chapter
  // 3. grab all verses in current chapter including current verse
  let bookIndex = bookIndexFromName(bookName);
  while (bookIndex >= 1) {
    // get and accumulate verses from the previous book down (hence bookIndex - 1)
    verseCount += versesInBookId(bookIndex - 1);
    bookIndex -= 1;
  }

  const chapterIndex = scriptureRangePart.chapter - 1;
  // reset bookIndex to the current book (needed because of the above while loop)
  bookIndex = bookIndexFromName(bookName);
  // add all verses from previous chapters, but not the current one since we only add through the verse, not the whole chapter
  let i = 0;
  while (i < chapterIndex) {
    // add all chapters starting with the first
    verseCount += books[bookIndex].chapters[i];
    i += 1;
  }
  // this is to start the absolute verse number counting at 0 –– "Genesis 1:1" has an AVN of 0 "Genesis 1:2" is 1, etc
  verseCount += scriptureRangePart.verse - 1;
  return verseCount;
};
export const verseToScriptureRange = (range: VerseRange): ScriptureRange => {
  return {
    start: {
      ...verseIdToReference(range.start),
    },
    end: { ...verseIdToReference(range.end) },
  };
};
const verseIdToReference = (verseId: number): ScriptureReference => {
  // let's add one here since we start counting from 0 - it will make calculations simpler and will fix the 1-offset for the scripture reference verse number
  let versesRemaining = verseId + 1;
  let bookIndex = 0;

  // versesRemaining will equal 0 when it's Genesis 1:1
  while (versesRemaining > 0) {
    const versesInThisBook = versesInBookId(bookIndex);
    // if the range is the whole book like Ruth 1-4, then versesRemaining - versesInThisBook will be 0
    if (versesRemaining - versesInThisBook <= 0) {
      const book = books[bookIndex];
      let chapterIndex = 0;
      // again here versesRemaining will equal 0 when it's Gen 1:1
      while (versesRemaining > 0) {
        const versesInThisChapter = book.chapters[chapterIndex];

        if (versesRemaining - versesInThisChapter <= 0) {
          return {
            book: bookNameFromId(bookIndex),
            chapter: chapterIndex + 1,
            verse: versesRemaining,
          };
        }
        versesRemaining -= versesInThisChapter;
        chapterIndex += 1;
      }
    }
    versesRemaining -= versesInThisBook;
    bookIndex += 1;
  }
  throw new Error('Invalid verse number');
};
// Given a string of a book name (shortened or full length), get the book id
export const bookIndexFromName = (name: string) => {
  name = name.toLowerCase();
  const book = books.find((book) => {
    const bookNames = book.names.map((n) => n.toLowerCase());
    return bookNames.includes(name);
  });
  if (book) {
    return books.indexOf(book);
  }
  throw new Error('No book matched "' + name + '"');
};
const versesInBookId = (bookIndex: number) => {
  const total = books[bookIndex].chapters.reduce(function sum(a, b) {
    return a + b;
  });
  return total;
};
// Given a book id, get the full length book name
const bookNameFromId = (id: number) => {
  const book = books[id];
  if (!book) {
    throw new Error('Book id out of range (no such book)');
  }
  return book.names[0];
};
// Given a book code 'gen' for Genesis, get the full length book name
export const bookCodeToName = (code: string) => {
  code = code.toLowerCase();
  const book = books.find((book) => {
    const bookNames = book.names.map((n) => n.toLowerCase());
    return bookNames.includes(code);
  });
  if (!book) {
    throw new Error('No book exists with that code');
  }
  return book.names[0];
};

export const validateBook = (book: string): boolean => {
  try {
    bookIndexFromName(book);
    return true;
  } catch (e) {
    return false;
  }
};

export const validateChapter = (book: string, chapter: number): boolean => {
  const bookIndex = bookIndexFromName(book);
  return chapter <= books[bookIndex].chapters.length && chapter > 0;
};

export const validateVerse = (
  book: string,
  chapter: number,
  verse: number
): boolean => {
  const bookIndex = bookIndexFromName(book);
  return verse <= books[bookIndex].chapters[chapter - 1] && verse > 0;
};

// return random scriptureRefenence as an array
export const createRandomScriptureReferences = (): ScriptureRangeInput[] => [
  createRandomScriptureRange(),
  createRandomScriptureRange(),
];

const createRandomScriptureRange = (): ScriptureRangeInput => {
  const book = books[random(books.length - 1)];
  const endChapter = random(book.chapters.length - 1);
  const endVerse = random(book.chapters[endChapter] - 1);
  const startChapter = random(endChapter);
  const startVerse = random(endVerse);

  return {
    start: {
      book: book.names[0],
      chapter: startChapter + 1,
      verse: startVerse + 1,
    },
    end: {
      book: book.names[0],
      chapter: endChapter + 1,
      verse: endVerse + 1,
    },
  };
};
