import { compact, parseInt } from 'lodash';
import { InputException } from '../../common';
import { Book, Verse } from './books';
import { ScriptureRange } from './dto';
import { mergeScriptureRanges } from './labels';

/**
 * Example inputs:
 * - Genesis 1
 * - Genesis 1-2
 * - Genesis 3:5-45
 * - 1 John 3, 4
 * - Luke 1 and Matthew 1
 */
export const parseScripture = (
  input: string | null | undefined
): readonly ScriptureRange[] => {
  if (!input || !input.trim()) {
    return [];
  }

  const rawRefs = compact(
    input
      .replace(/ and /gi, ' , ')
      .split(/[,;]/)
      .map((p) => p.trim())
  );

  const refs = [];
  let lastCompleteRef: ScriptureRange | undefined = undefined;
  for (const rawRef of rawRefs) {
    const parsedRef = parseRange(rawRef, lastCompleteRef?.start.book);
    refs.push(parsedRef);
    lastCompleteRef = parsedRef;
  }

  return mergeScriptureRanges(refs);
};

const parseRange = (input: string, fallbackBook?: string) => {
  const given = lexRange(input);
  if (!given.start.book && !fallbackBook) {
    throw new InputException(
      'Cannot parse partial reference without previous complete reference'
    );
  }
  const start = Book.find(given.start.book ?? fallbackBook!)
    .chapter(given.start.chapter ?? 1)
    .verse(given.start.verse ?? 1);
  const endBook = Book.find(given.end.book ?? start.book.name);
  const end = Verse.fromRef({
    book: endBook.name,
    ...(given.start.chapter &&
    given.start.verse &&
    !given.end.chapter &&
    !given.end.verse
      ? {
          chapter: start.chapter.chapter,
          verse: start.verse,
        }
      : {
          chapter:
            given.end.chapter ??
            given.start.chapter ??
            endBook.lastChapter.chapter,
          verse:
            given.end.verse ??
            endBook.chapter(
              given.end.chapter ??
                given.start.chapter ??
                endBook.lastChapter.chapter
            ).lastVerse.verse,
        }),
  });
  return ScriptureRange.fromVerses({ start, end });
};

const lexRange = (input: string) => {
  const [startRaw, endRaw] = input.split(/[-–]/);
  const start = lexRef(startRaw);
  const end = lexRef(endRaw ?? '');
  // Handle special case of `1:1-3` where 3 should be the end verse not the end chapter
  if (start.verse && end.chapter && !end.verse) {
    end.verse = end.chapter;
    end.chapter = start.chapter;
  }
  return { start, end };
};

const lexRef = (str: string) => {
  const matches = /^(\d?[ A-Za-z]+)?(\d*)(?:\s*:\s*(\d+))?$/.exec(str.trim());
  const book = matches?.[1]?.trim() || undefined;
  const chapter = parseInt(matches?.[2] ?? '', 10) || undefined;
  const verse = parseInt(matches?.[3] ?? '', 10) || undefined;
  return { book, chapter, verse };
};
