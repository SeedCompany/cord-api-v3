import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../common';

@InputType()
export abstract class PossibleState {
  @IdField()
  readonly fromStateId: string;

  @IdField()
  readonly toStateId: string;
}

@InputType()
export abstract class PossibleStateInput {
  @Field()
  @Type(() => PossibleState)
  @ValidateNested()
  readonly state: PossibleState;
}
