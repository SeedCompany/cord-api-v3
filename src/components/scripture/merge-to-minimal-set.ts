import { Range } from '../../common';
import { ScriptureRange } from './dto';

/**
 * Merges ScriptureRanges into an equivalent minimal set of ScriptureRanges.
 * Combines overlapping and adjacent ScriptureRanges.
 * Also sorts them.
 */
export const mergeScriptureRanges = (
  ranges: readonly ScriptureRange[],
): readonly ScriptureRange[] =>
  mergeScriptureRangesToMinimalIds(ranges).map(ScriptureRange.fromIds);

export const mergeScriptureRangesToMinimalIds = (
  ranges: readonly ScriptureRange[],
) => {
  // Adapted from Luxon's Interval.merge logic
  const [found, final] = ranges
    .map(ScriptureRange.fromReferences)
    .sort((a, b) => a.start - b.start)
    .reduce(
      ([sofar, current], item) => {
        if (!current) {
          return [sofar, item];
        }
        // if current overlaps item or current's end is adjacent to item's start
        if (
          (current.end > item.start && current.start < item.end) ||
          current.end === item.start - 1
        ) {
          return [
            sofar,
            // Merge current & item
            {
              start: current.start < item.start ? current.start : item.start,
              end: current.end > item.end ? current.end : item.end,
            },
          ];
        }
        return [[...sofar, current], item];
      },
      [[], null] as [Array<Range<number>>, Range<number> | null],
    );
  if (final) {
    found.push(final);
  }
  return found;
};
