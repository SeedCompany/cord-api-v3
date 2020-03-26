import { Field, ID, InputType, ObjectType } from 'type-graphql';

@InputType()
export class UpdateSecurityGroupName {
  @Field(() => ID)
  readonly id: string;

  @Field()
  readonly name: string;
}

@InputType()
export abstract class UpdateSecurityGroupNameInput {
  @Field()
  readonly request: UpdateSecurityGroupName;
}

@ObjectType()
export class UpdateSecurityGroupNameOutput {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;
}
