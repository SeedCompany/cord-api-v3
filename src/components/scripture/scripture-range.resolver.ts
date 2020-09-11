import { Int, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { books } from './books';
import { ScriptureRange } from './dto';
import { bookIndexFromName } from './reference';

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
  label(@Parent() _range: ScriptureRange): string {
    const bookIndex = bookIndexFromName(_range.end.book);
    const lastChapter = books[bookIndex].chapters.length;
    const lastVerse = books[bookIndex].chapters[_range.end.chapter - 1];
    if (_range.start.book === _range.end.book) {
      if (_range.start.verse === 1 && _range.end.verse === lastVerse) {
        if (_range.start.chapter === 1 && _range.end.chapter === lastChapter) {
          // - Matthew
          return `${_range.start.book}`;
        } else if (_range.start.chapter === _range.end.chapter) {
          // - Matthew 1
          return `${_range.start.book} ${_range.start.chapter}`;
        } else {
          // - Matthew 1-4
          return `${_range.start.book} ${_range.start.chapter}-${_range.end.chapter}`;
        }
      } else if (_range.start.chapter === _range.end.chapter) {
        if (_range.start.verse === _range.end.verse) {
          // - Matthew 1:1
          return `${_range.start.book} ${_range.start.chapter}:${_range.start.verse}`;
        } else {
          // - Matthew 1:1-20
          return `${_range.start.book} ${_range.start.chapter}:${_range.start.verse}-${_range.end.verse}`;
        }
      } else {
        // Matthew 1:1-4:21
        return `${_range.start.book} ${_range.start.chapter}:${_range.start.verse}-${_range.end.chapter}:${_range.end.verse}`;
      }
    } else if (_range.start.verse === 1 && _range.end.verse === lastVerse) {
      if (_range.start.chapter === 1 && _range.end.chapter === lastChapter) {
        // - Matthew-John
        return `${_range.start.book}-${_range.end.book}`;
      } else {
        // - Matthew 1-John 2
        return `${_range.start.book} ${_range.start.chapter}-${_range.end.book} ${_range.end.chapter}`;
      }
    } else {
      // - Matthew 1:1-John 2:4
      return `${_range.start.book} ${_range.start.chapter}:${_range.start.verse}-${_range.end.book} ${_range.end.chapter}:${_range.end.verse}`;
    }
  }

  @ResolveField(() => Int, {
    description: 'The total number of verses in this scripture range',
  })
  totalVerses(@Parent() _range: ScriptureRange): number {
    // TODO
    return 0;
  }
}
