import { uniq } from 'lodash';
import { Verse } from './books';
import { mapRange, ScriptureRange, ScriptureReference } from './dto';
import { mergeScriptureRanges } from './merge-to-minimal-set';

export const labelOfScriptureRange = (
  ref: ScriptureRange,
  omit?: 'book' | 'chapter',
): string => {
  const { start, end } = mapRange(ref, Verse.fromRef);
  if (start.book.equals(end.book)) {
    if (start.isFirst && end.isLast) {
      if (start.chapter.isFirst && end.chapter.isLast) {
        // Matthew
        return start.book.label;
      } else if (start.chapter.equals(end.chapter)) {
        // Matthew 1
        if (omit === 'book') {
          return start.chapter.chapter.toString();
        }
        return start.chapter.label;
      } else {
        // Matthew 1–4
        if (omit === 'book') {
          return `${start.chapter.chapter}–${end.chapter.chapter}`;
        }
        return `${start.chapter.label}–${end.chapter.chapter}`;
      }
    } else if (start.chapter.equals(end.chapter)) {
      if (start.equals(end)) {
        // Matthew 1:1
        if (omit === 'chapter') {
          return start.verse.toString();
        }
        if (omit === 'book') {
          return `${start.chapter.chapter}:${start.verse}`;
        }
        return start.label;
      } else {
        // Matthew 1:1–20
        if (omit === 'chapter') {
          return `${start.verse}–${end.verse}`;
        }
        if (omit === 'book') {
          return `${start.chapter.chapter}:${start.verse}–${end.chapter.chapter}:${end.verse}`;
        }
        return `${start.label}–${end.verse}`;
      }
    } else {
      // Matthew 1:1–4:21
      if (omit === 'book') {
        return `${start.chapter.chapter}:${start.verse}–${end.chapter.chapter}:${end.verse}`;
      }
      return `${start.label}–${end.chapter.chapter}:${end.verse}`;
    }
  } else if (start.isFirst && end.isLast) {
    if (start.chapter.isFirst && end.chapter.isLast) {
      if (start.book.name === 'Genesis' && end.book.name === 'Malachi') {
        return 'Old Testament';
      }
      if (start.book.name === 'Matthew' && end.book.name === 'Revelation') {
        return 'New Testament';
      }
      // Matthew-John
      return `${start.book.label}–${end.book.label}`;
    } else {
      // Matthew 1-John 2
      return `${start.chapter.label}–${end.chapter.label}`;
    }
  } else {
    // Matthew 1:1-John 2:4
    return `${start.label}–${end.label}`;
  }
};

export const labelOfScriptureRanges = (
  refs: readonly ScriptureRange[],
  collapseAfter?: number,
) => {
  if (refs.length === 0) {
    return '';
  }
  if (refs.length === 1) {
    return labelOfScriptureRange(refs[0]);
  }
  refs = mergeScriptureRanges(refs);
  if (refs.length === 1) {
    return labelOfScriptureRange(refs[0]);
  }

  const hasSame = (key: keyof ScriptureReference) =>
    uniq(refs.flatMap((ref) => [ref.start[key], ref.end[key]])).length === 1;
  const same = hasSame('book') ? 'book' : undefined;
  const totalRefs = refs.length;
  const labels = refs
    .slice(0, collapseAfter)
    .map((ref) => labelOfScriptureRange(ref, same));
  const prefix = same === 'book' ? `${refs[0].start.book} ` : '';
  const labelOutput = new Intl.ListFormat(undefined, {
    style: prefix ? 'narrow' : undefined,
  }).format([
    ...labels,
    ...(collapseAfter && totalRefs > collapseAfter
      ? [`${totalRefs - collapseAfter} other portions`]
      : []),
  ]);
  return `${prefix}${labelOutput}`;
};
