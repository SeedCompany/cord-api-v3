import { Type } from '@nestjs/common';
import { Field, ID, ObjectType } from 'type-graphql';

@ObjectType()
export class Workflow {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Workflow as any) as Type<Workflow>;
  @Field(() => ID)
  readonly id: string;

  @Field()
  readonly stateIdentifier: string;
}
