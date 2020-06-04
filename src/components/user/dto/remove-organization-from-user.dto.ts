import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class RemoveOrganizationFromUser {
  @Field(() => ID)
  readonly orgId: string;

  @Field(() => ID)
  readonly userId: string;
}

@InputType()
export abstract class RemoveOrganizationFromUserInput {
  @Field()
  readonly request: RemoveOrganizationFromUser;
}
