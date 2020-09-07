import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { stripIndent } from 'common-tags';
import { SecuredPropertyList } from '../../../common';
import { IsValidOrder } from './scripture-range.validator';
import {
  ScriptureReference,
  ScriptureReferenceInput,
} from './scripture-reference.dto';
import {
  ScriptureEnd,
  ScriptureStart,
} from './scripture-reference.transformer';

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
  @Type(() => ScriptureReferenceInput)
  @ScriptureStart()
  start: ScriptureReferenceInput;

  @Field({
    description: 'The ending verse',
  })
  @ValidateNested()
  @IsValidOrder()
  @Type(() => ScriptureReferenceInput)
  @ScriptureEnd()
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

@ObjectType({
  description: SecuredPropertyList.descriptionFor('scripture ranges override'),
})
export class SecuredScriptureRangesOverride extends SecuredPropertyList(
  ScriptureRange,
  { nullable: true }
) {}
