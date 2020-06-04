import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class AssignOrganizationToUser {
  @Field(() => ID)
  readonly orgId: string;

  @Field(() => ID)
  readonly userId: string;

  @Field(() => Boolean, { nullable: true })
  readonly primary?: boolean;
}

@InputType()
export abstract class AssignOrganizationToUserInput {
  @Field()
  readonly request: AssignOrganizationToUser;
}
