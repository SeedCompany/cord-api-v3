import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class State {
  @Field(() => ID)
  readonly id: string;

  @Field()
  readonly value: string;
}

@ObjectType()
export class CurrentState {
  @Field(() => ID)
  readonly id: string;
}
