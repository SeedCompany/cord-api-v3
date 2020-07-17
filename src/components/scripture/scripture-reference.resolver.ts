import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ScriptureReference } from './dto';
import { bookCodeToName } from './reference';

@Resolver(ScriptureReference)
export class ScriptureReferenceResolver {
  @ResolveField(() => String)
  bookName(@Parent() ref: ScriptureReference): string {
    return bookCodeToName(ref.book);
  }

  @ResolveField(() => String)
  label(@Parent() ref: ScriptureReference): string {
    const book = bookCodeToName(ref.book);
    return `${book} ${ref.chapter}:${ref.verse}`;
  }
}
