import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Permission {
  @Field(() => ID)
  readonly id: string;

  @Field()
  readonly property: string;

  @Field(() => Boolean)
  readonly read: boolean;

  @Field(() => Boolean)
  readonly write: boolean;
}
