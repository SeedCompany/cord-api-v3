import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
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
  @Type(() => AssignOrganizationToUser)
  @ValidateNested()
  readonly request: AssignOrganizationToUser;
}
