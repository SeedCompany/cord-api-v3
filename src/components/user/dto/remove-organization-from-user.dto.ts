import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
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
  @Type(() => RemoveOrganizationFromUser)
  @ValidateNested()
  readonly request: RemoveOrganizationFromUser;
}
