import { DateTime } from 'luxon';
import { Field, ID, InterfaceType, ObjectType } from 'type-graphql';
import { DateTimeField } from './luxon.graphql';

@InterfaceType()
@ObjectType({
  isAbstract: true,
})
export abstract class Resource {
  @Field(() => ID)
  readonly id: string;

  @DateTimeField()
  readonly createdAt: DateTime;

  protected constructor() {
    // no instantiation, shape only
  }
}
