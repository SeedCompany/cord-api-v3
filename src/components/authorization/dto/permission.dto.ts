import { Field, ObjectType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@ObjectType()
export class Permission {
  @IdField()
  readonly id: string;

  @Field()
  readonly property: string;

  @Field(() => Boolean)
  readonly read: boolean;

  @Field(() => Boolean)
  readonly write: boolean;
}
