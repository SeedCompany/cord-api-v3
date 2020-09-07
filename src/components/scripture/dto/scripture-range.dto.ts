import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { stripIndent } from 'common-tags';
import { SecuredPropertyList } from '../../../common';
import {
  ScriptureReference,
  ScriptureReferenceEndInput,
  ScriptureReferenceStartInput,
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
  @ValidateNested()
  @Type(() => ScriptureReferenceStartInput)
  start: ScriptureReferenceStartInput;

  @Field({
    description: 'The ending verse',
  })
  @ValidateNested()
  @Type(() => ScriptureReferenceEndInput)
  end: ScriptureReferenceEndInput;
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

@ObjectType({
  description: SecuredPropertyList.descriptionFor('scripture ranges override'),
})
export class SecuredScriptureRangesOverride extends SecuredPropertyList(
  ScriptureRange,
  { nullable: true }
) {}
