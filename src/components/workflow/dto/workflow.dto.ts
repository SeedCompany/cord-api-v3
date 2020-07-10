import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ValidateNested } from 'class-validator';
import { State } from './state.dto';

@ObjectType()
export class Workflow {
  @Field(() => ID)
  readonly id: string;

  @Field()
  readonly stateIdentifier: string;

  @Field(() => State)
  @ValidateNested()
  readonly startingState: State;
}
