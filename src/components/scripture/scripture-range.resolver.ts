import { Int, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ScriptureRange } from './dto';
import { scriptureToVerseRange } from './reference';

@Resolver(ScriptureRange)
export class ScriptureRangeResolver {
  @ResolveField(() => String, {
    description: stripIndent`
      A human readable label for this range.

      Examples:
        - Matthew
        - Matthew 1
        - Matthew 1-4
        - Matthew 1:4-20
        - Matthew 1:4-3:21
        - Matthew 1-John 2
        - Matthew 1:3-John 2:4
    `,
  })
  label(@Parent() _range: ScriptureRange): string {
    // TODO
    return ``;
  }

  @ResolveField(() => Int, {
    description: 'The total number of verses in this scripture range',
  })
  totalVerses(@Parent() range: ScriptureRange): number {
    const verseRange = scriptureToVerseRange(range);
    return verseRange.end - verseRange.start + 1;
  }
}
