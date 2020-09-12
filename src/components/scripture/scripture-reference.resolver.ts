import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Book, Verse } from './books';
import { ScriptureReference } from './dto';

@Resolver(ScriptureReference)
export class ScriptureReferenceResolver {
  @ResolveField(() => String)
  bookName(@Parent() ref: ScriptureReference): string {
    return Book.fromRef(ref).name;
  }

  @ResolveField(() => String)
  label(@Parent() ref: ScriptureReference): string {
    return Verse.fromRef(ref).label;
  }
}
