import { ObjectType } from '@nestjs/graphql';
import { Range, Verse } from '@seedcompany/scripture';

@ObjectType()
export class ScriptureCollection {
  verses: ReadonlyArray<Range<Verse>>;
}
