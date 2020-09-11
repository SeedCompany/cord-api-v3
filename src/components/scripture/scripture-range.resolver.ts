import { Int, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { books } from './books';
import { ScriptureRange } from './dto';
import { bookIndexFromName, scriptureToVerseRange } from './reference';

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
  label(@Parent() { start, end }: ScriptureRange): string {
    const bookIndex = bookIndexFromName(end.book);
    const lastChapter = books[bookIndex].chapters.length;
    const lastVerse = books[bookIndex].chapters[end.chapter - 1];
    if (start.book === end.book) {
      if (start.verse === 1 && end.verse === lastVerse) {
        if (start.chapter === 1 && end.chapter === lastChapter) {
          // - Matthew
          return `${start.book}`;
        } else if (start.chapter === end.chapter) {
          // - Matthew 1
          return `${start.book} ${start.chapter}`;
        } else {
          // - Matthew 1-4
          return `${start.book} ${start.chapter}-${end.chapter}`;
        }
      } else if (start.chapter === end.chapter) {
        if (start.verse === end.verse) {
          // - Matthew 1:1
          return `${start.book} ${start.chapter}:${start.verse}`;
        } else {
          // - Matthew 1:1-20
          return `${start.book} ${start.chapter}:${start.verse}-${end.verse}`;
        }
      } else {
        // Matthew 1:1-4:21
        return `${start.book} ${start.chapter}:${start.verse}-${end.chapter}:${end.verse}`;
      }
    } else if (start.verse === 1 && end.verse === lastVerse) {
      if (start.chapter === 1 && end.chapter === lastChapter) {
        // - Matthew-John
        return `${start.book}-${end.book}`;
      } else {
        // - Matthew 1-John 2
        return `${start.book} ${start.chapter}-${end.book} ${end.chapter}`;
      }
    } else {
      // - Matthew 1:1-John 2:4
      return `${start.book} ${start.chapter}:${start.verse}-${end.book} ${end.chapter}:${end.verse}`;
    }
  }

  @ResolveField(() => Int, {
    description: 'The total number of verses in this scripture range',
  })
  totalVerses(@Parent() range: ScriptureRange): number {
    const verseRange = scriptureToVerseRange(range);
    return verseRange.end - verseRange.start + 1;
  }
}
