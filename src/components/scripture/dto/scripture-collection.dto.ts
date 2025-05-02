import { ObjectType } from '@nestjs/graphql';
import { type Range, type Verse } from '@seedcompany/scripture';

@ObjectType()
export class ScriptureCollection {
  verses: ReadonlyArray<Range<Verse>>;
}
