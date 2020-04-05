import { Type } from '@nestjs/common';
import { ObjectType } from 'type-graphql';
import { Resource } from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class Workflow extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Workflow as any) as Type<Workflow>;
}
