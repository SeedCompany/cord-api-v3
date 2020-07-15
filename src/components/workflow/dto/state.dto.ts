import { Field, ObjectType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@ObjectType()
export class State {
  @IdField()
  readonly id: string;

  @Field()
  readonly value: string;
}

@ObjectType()
export class CurrentState {
  @IdField()
  readonly id: string;
}
