import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Range } from './range';

@InputType()
export abstract class CreateRange {
  @Field()
  readonly start: number;

  @Field()
  readonly end: number;
}

@InputType()
export abstract class CreateRangeInput {
  @Field()
  @Type(() => CreateRange)
  @ValidateNested()
  readonly range: CreateRange;
}

@ObjectType()
export abstract class CreateRangeOutput {
  @Field()
  readonly range: Range;
}
