import { Field, ObjectType } from '@nestjs/graphql';
import { ID, IdField } from '../../../common';

@ObjectType()
export class State {
  @IdField()
  readonly id: ID;

  @Field()
  readonly value: string;
}

@ObjectType()
export class CurrentState {
  @IdField()
  readonly id: ID;
}
