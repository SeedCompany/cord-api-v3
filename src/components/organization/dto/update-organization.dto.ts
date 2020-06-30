import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { Organization } from './organization';

@InputType()
export abstract class UpdateOrganization {
  @Field(() => ID)
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;
}

@InputType()
export abstract class UpdateOrganizationInput {
  @Field()
  @Type(() => UpdateOrganization)
  @ValidateNested()
  readonly organization: UpdateOrganization;
}

@ObjectType()
export abstract class UpdateOrganizationOutput {
  @Field()
  readonly organization: Organization;
}
