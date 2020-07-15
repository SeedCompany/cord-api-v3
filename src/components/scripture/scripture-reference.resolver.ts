import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ScriptureReference } from './dto';

@Resolver(ScriptureReference)
export class ScriptureReferenceResolver {
  @ResolveField(() => String)
  bookName(@Parent() ref: ScriptureReference): string {
    // TODO convert book code to name
    return ref.book;
  }

  @ResolveField(() => String)
  label(@Parent() ref: ScriptureReference): string {
    // TODO convert book code to name
    return `${ref.book} ${ref.chapter}:${ref.verse}`;
  }
}
