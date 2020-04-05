import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType } from 'type-graphql';

@InputType()
export abstract class FieldState {
  @Field(() => ID)
  readonly stateId: string;

  @Field()
  readonly propertyName: string;
}

@InputType()
export abstract class FieldStateInput {
  @Field()
  @Type(() => FieldState)
  @ValidateNested()
  readonly state: FieldState;
}
