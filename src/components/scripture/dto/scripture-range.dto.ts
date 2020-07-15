import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { SecuredPropertyList } from '../../../common';
import {
  ScriptureReference,
  ScriptureReferenceInput,
} from './scripture-reference.dto';

const description = stripIndent`
  A range of scripture.
  i.e. Matthew 1:1-2:10
`;

@InputType()
export abstract class ScriptureRangeInput {
  @Field({
    description: 'The starting verse',
  })
  start: ScriptureReferenceInput;

  @Field({
    description: 'The ending verse',
  })
  end: ScriptureReferenceInput;
}

@ObjectType({
  description,
})
export abstract class ScriptureRange {
  @Field({
    description: 'The starting verse',
  })
  start: ScriptureReference;

  @Field({
    description: 'The ending verse',
  })
  end: ScriptureReference;
}

@ObjectType({
  description: SecuredPropertyList.descriptionFor('scripture ranges'),
})
export class SecuredScriptureRanges extends SecuredPropertyList(
  ScriptureRange
) {}
