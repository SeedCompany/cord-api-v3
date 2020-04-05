import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType } from 'type-graphql';

@InputType()
export abstract class PossibleState {
  @Field(() => ID)
  readonly fromStateId: string;

  @Field(() => ID)
  readonly toStateId: string;
}

@InputType()
export abstract class PossibleStateInput {
  @Field()
  @Type(() => PossibleState)
  @ValidateNested()
  readonly state: PossibleState;
}
