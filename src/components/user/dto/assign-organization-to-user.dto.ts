import { Field, InputType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@InputType()
export class AssignOrganizationToUser {
  @IdField()
  readonly orgId: string;

  @IdField()
  readonly userId: string;

  @Field(() => Boolean, { nullable: true })
  readonly primary?: boolean;
}

@InputType()
export abstract class AssignOrganizationToUserInput {
  @Field()
  readonly request: AssignOrganizationToUser;
}
