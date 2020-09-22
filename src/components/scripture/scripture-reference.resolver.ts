import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Verse } from './books';
import { ScriptureReference } from './dto';

@Resolver(ScriptureReference)
export class ScriptureReferenceResolver {
  @ResolveField(() => String)
  label(@Parent() ref: ScriptureReference): string {
    return Verse.fromRef(ref).label;
  }
}
