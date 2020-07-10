import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SecurityGroup {
  @Field(() => ID)
  readonly id: string;

  @Field()
  readonly name: string;
}
