import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { random, times } from 'lodash';
import { keys as keysOf } from 'ts-transformer-keys';
import { Range, SecuredPropertyList, SecuredProps } from '../../../common';
import { Verse } from '../books';
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

export const mapRange = <T, U = T>(
  input: Range<T>,
  mapper: (point: T) => U
): Range<U> => ({
  start: mapper(input.start),
  end: mapper(input.end),
});

@InputType()
export abstract class ScriptureRangeInput {
  @Field({
    description: 'The starting point',
  })
  @ScriptureStart()
  start: ScriptureReferenceInput;

  @Field({
    description: 'The ending point',
  })
  @IsValidOrder()
  @ScriptureEnd()
  end: ScriptureReferenceInput;
}

@ObjectType({
  description,
})
export abstract class ScriptureRange implements Range<ScriptureReference> {
  static readonly Props = keysOf<ScriptureRange>();
  static readonly SecuredProps = keysOf<SecuredProps<ScriptureRange>>();

  @Field({
    description: 'The starting point',
  })
  start: ScriptureReference;

  @Field({
    description: 'The ending point',
  })
  end: ScriptureReference;

  static fromIds(range: Range<number>) {
    return mapRange(range, (p) => Verse.fromId(p).reference);
  }

  static fromReferences(range: Range<ScriptureReference>) {
    return mapRange(range, (p) => Verse.fromRef(p).id);
  }

  static random() {
    const start = Verse.random();
    return {
      start: start.reference,
      end: Verse.random(start).reference,
    };
  }

  static randomList(min = 2, max = 4) {
    return times(random(min, max)).map(ScriptureRange.random);
  }
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
