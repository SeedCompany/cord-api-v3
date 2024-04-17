import {
  Args,
  Float,
  Int,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { labelOfVerseRanges, parseScripture } from '@seedcompany/scripture';
import { ScriptureRange } from './dto';
import { ScriptureCollection } from './dto/scripture-collection.dto';
import { getTotalVerseEquivalents } from './verse-equivalents';

@Resolver(ScriptureCollection)
export class ScriptureCollectionResolver {
  @Query(() => ScriptureCollection)
  parseScripture(
    @Args({ name: 'text', type: () => [String] }) text: readonly string[],
  ): ScriptureCollection {
    const verses = text.flatMap(parseScripture);
    return { verses };
  }

  @ResolveField(() => [ScriptureRange])
  ranges(@Parent() { verses }: ScriptureCollection): readonly ScriptureRange[] {
    return verses.map((v) => ScriptureRange.fromVerses(v));
  }

  @ResolveField(() => String)
  label(@Parent() { verses }: ScriptureCollection): string {
    return labelOfVerseRanges(verses);
  }

  @ResolveField(() => Int, {
    description: 'The total number of verses in this scripture collection',
  })
  totalVerses(@Parent() { verses }: ScriptureCollection): number {
    return ScriptureRange.totalVerses(...verses);
  }

  @ResolveField(() => Float, {
    description:
      'The total number of verse equivalents in this scripture collection',
  })
  totalVerseEquivalents(@Parent() { verses }: ScriptureCollection): number {
    return getTotalVerseEquivalents(...verses);
  }
}
