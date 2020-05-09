import { Type } from '@nestjs/common';
import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Permission {
  static classType = (Permission as any) as Type<Permission>;

  @Field(() => ID)
  readonly id: string;

  @Field()
  readonly property: string;

  @Field(() => Boolean)
  readonly read: boolean;

  @Field(() => Boolean)
  readonly write: boolean;
}
