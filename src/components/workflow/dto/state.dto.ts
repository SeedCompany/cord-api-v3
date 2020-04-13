import { Type } from '@nestjs/common';
import { Field, ID, ObjectType } from 'type-graphql';

@ObjectType()
export class State {
  /* TS wants a public constructor for "ClassType" */
  static classType = (State as any) as Type<State>;

  @Field(() => ID)
  readonly id: string;

  @Field()
  readonly value: string;
}

@ObjectType()
export class CurrentState {
  /* TS wants a public constructor for "ClassType" */
  static classType = (CurrentState as any) as Type<CurrentState>;

  @Field(() => ID)
  readonly id: string;
}
