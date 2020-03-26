import { Field, ID, InputType } from 'type-graphql';

@InputType()
export class PromoteUserToAdminOfSecurityGroup {
  @Field(() => ID)
  readonly sgId: string;

  @Field(() => ID)
  readonly userId: string;
}

@InputType()
export abstract class PromoteUserToAdminOfSecurityGroupInput {
  @Field()
  readonly request: PromoteUserToAdminOfSecurityGroup;
}
