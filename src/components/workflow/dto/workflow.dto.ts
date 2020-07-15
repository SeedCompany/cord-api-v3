import { Field, ObjectType } from '@nestjs/graphql';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../common';
import { State } from './state.dto';

@ObjectType()
export class Workflow {
  @IdField()
  readonly id: string;

  @Field()
  readonly stateIdentifier: string;

  @Field(() => State)
  @ValidateNested()
  readonly startingState: State;
}
