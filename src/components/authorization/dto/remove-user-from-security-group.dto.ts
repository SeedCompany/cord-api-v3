import { Field, ID, InputType } from 'type-graphql';

@InputType()
export class RemoveUserFromSecurityGroup {
  @Field(() => ID)
  readonly sgId: string;

  @Field(() => ID)
  readonly userId: string;
}

@InputType()
export abstract class RemoveUserFromSecurityGroupInput {
  @Field()
  readonly request: RemoveUserFromSecurityGroup;
}
