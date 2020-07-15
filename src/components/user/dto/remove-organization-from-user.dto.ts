import { Field, InputType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@InputType()
export class RemoveOrganizationFromUser {
  @IdField()
  readonly orgId: string;

  @IdField()
  readonly userId: string;
}

@InputType()
export abstract class RemoveOrganizationFromUserInput {
  @Field()
  readonly request: RemoveOrganizationFromUser;
}
