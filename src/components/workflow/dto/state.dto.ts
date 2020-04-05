import { Type } from '@nestjs/common';
import { Field, ObjectType } from 'type-graphql';
import { Resource } from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class State extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (State as any) as Type<State>;

  @Field()
  readonly stateName: string;
}

@ObjectType({
  implements: [Resource],
})
export class CurrentState extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (CurrentState as any) as Type<CurrentState>;
}
