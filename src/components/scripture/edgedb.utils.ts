import { Nil } from '@seedcompany/common';
import {
  labelOfVerseRange,
  labelOfVerseRanges,
  Verse,
} from '@seedcompany/scripture';
import { $, e } from '~/core/edgedb';
import { $expr_Param } from '~/core/edgedb/generated-client/params';
import { $expr_PathNode } from '~/core/edgedb/generated-client/path';
import { ScriptureRangeInput } from './dto';

const verse = e.tuple({
  book: e.str,
  chapter: e.int16,
  verse: e.int16,
  verseId: e.int16,
});

const verseRangeType = e.tuple({
  label: e.str,
  start: verse,
  end: verse,
});
const verseRange = e.tuple({
  label: e.str,
  '`start`': verse,
  '`end`': verse,
}) as any as typeof verseRangeType;

export const type = e.tuple({
  label: e.str,
  verses: e.array(verseRange),
});

export const valueOptional = (input: readonly ScriptureRangeInput[] | Nil) =>
  input === undefined
    ? undefined
    : input && input.length > 0
    ? value(input)
    : null;

export const value = (input: readonly ScriptureRangeInput[]) => ({
  label: labelOfVerseRanges(input),
  verses: input.map((verseRange) => ({
    label: labelOfVerseRange(verseRange),
    start: {
      ...verseRange.start,
      verseId: Verse.from(verseRange.start).id,
    },
    end: {
      ...verseRange.end,
      verseId: Verse.from(verseRange.end).id,
    },
  })),
});

export const insert = (param: $expr_Param<string, typeof type>) => {
  const insertQuery = e.insert(e.Scripture.Collection, {
    label: e.cast(e.str, param.label),
    verses: e.for(e.array_unpack(param.verses), (verseRange) => {
      const start = (verseRange as any)['`start`'] as typeof verseRange.start;
      const end = (verseRange as any)['`end`'] as typeof verseRange.end;
      return e.insert(e.Scripture.VerseRange, {
        label: e.cast(e.str, verseRange.label),
        start: e.insert(e.Scripture.Verse, {
          book: e.cast(e.str, start.book),
          chapter: e.cast(e.int16, start.chapter),
          verse: e.cast(e.int16, start.verse),
          verseId: e.cast(e.int16, start.verseId),
        }),
        end: e.insert(e.Scripture.Verse, {
          book: e.cast(e.str, end.book),
          chapter: e.cast(e.int16, end.chapter),
          verse: e.cast(e.int16, end.verse),
          verseId: e.cast(e.int16, end.verseId),
        }),
      });
    }),
  });

  if (param.__cardinality__ === 'One') {
    return insertQuery;
  }
  return e.op(
    insertQuery,
    'if',
    e.op('exists', param),
    'else',
    e.cast(e.Scripture.Collection, e.set()),
  );
};

const hydrateVerseRange = e.shape(e.Scripture.VerseRange, () => ({
  start: { book: true, chapter: true, verse: true },
  end: { book: true, chapter: true, verse: true },
}));

export const hydrate = <
  T extends $expr_PathNode<
    $.TypeSet<(typeof e.Scripture.Collection)['__element__']>
  >,
>(
  sc: T,
) => e.array_agg(e.select(sc.verses, hydrateVerseRange));
