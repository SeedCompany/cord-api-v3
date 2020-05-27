import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Range } from './range';

@InputType()
export abstract class UpdateRange {
  @Field(() => ID)
  readonly id: string;

  @Field()
  readonly start: number;

  @Field()
  readonly end: number;
}

@InputType()
export abstract class UpdateRangeInput {
  @Field()
  @Type(() => UpdateRange)
  @ValidateNested()
  readonly range: UpdateRange;
}

@ObjectType()
export abstract class UpdateRangeOutput {
  @Field()
  readonly range: Range;
}
