import { Type } from '@nestjs/common';
import { Field, ID, ObjectType } from 'type-graphql';

@ObjectType()
export class SecurityGroup {
  static classType = (SecurityGroup as any) as Type<SecurityGroup>;

  @Field(() => ID)
  readonly id: string;

  @Field()
  readonly name: string;
}
