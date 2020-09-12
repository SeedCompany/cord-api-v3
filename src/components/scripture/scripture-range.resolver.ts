import { Int, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Verse } from './books';
import { mapRange, ScriptureRange } from './dto';

@Resolver(ScriptureRange)
export class ScriptureRangeResolver {
  @ResolveField(() => String, {
    description: stripIndent`
      A human readable label for this range.

      Examples:
        - Matthew
        - Matthew 1
        - Matthew 1-4
        - Matthew 1:1
        - Matthew 1:1-20
        - Matthew 1:1-4:21
        - Matthew-John
        - Matthew 1-John 2
        - Matthew 1:1-John 2:4
    `,
  })
  label(@Parent() range: ScriptureRange): string {
    const { start, end } = mapRange(range, Verse.fromRef);
    if (start.book.equals(end.book)) {
      if (start.isFirst && end.isLast) {
        if (start.chapter.isFirst && end.chapter.isLast) {
          // Matthew
          return start.book.label;
        } else if (start.chapter.equals(end.chapter)) {
          // Matthew 1
          return start.label;
        } else {
          // Matthew 1-4
          return `${start.label}-${end.chapter.chapter}`;
        }
      } else if (start.chapter.equals(end.chapter)) {
        if (start.equals(end)) {
          // Matthew 1:1
          return start.label;
        } else {
          // Matthew 1:1-20
          return `${start.label}-${end.verse}`;
        }
      } else {
        // Matthew 1:1-4:21
        return `${start.label}-${end.chapter.chapter}:${end.verse}`;
      }
    } else if (start.isFirst && end.isLast) {
      if (start.chapter.isFirst && end.chapter.isLast) {
        // Matthew-John
        return `${start.book.label}-${end.book.label}`;
      } else {
        // Matthew 1-John 2
        return `${start.chapter.label}-${end.chapter.label}`;
      }
    } else {
      // Matthew 1:1-John 2:4
      return `${start.label}-${end.label}`;
    }
  }

  @ResolveField(() => Int, {
    description: 'The total number of verses in this scripture range',
  })
  totalVerses(@Parent() range: ScriptureRange): number {
    const verseRange = ScriptureRange.fromReferences(range);
    return verseRange.end - verseRange.start + 1;
  }
}
