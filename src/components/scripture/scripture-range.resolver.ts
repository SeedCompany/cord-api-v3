import { Int, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ScriptureRange } from './dto';
import { labelOfScriptureRange } from './labels';

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
    return labelOfScriptureRange(range);
  }

  @ResolveField(() => Int, {
    description: 'The total number of verses in this scripture range',
  })
  totalVerses(@Parent() range: ScriptureRange): number {
    const verseRange = ScriptureRange.fromReferences(range);
    return verseRange.end - verseRange.start + 1;
  }
}
