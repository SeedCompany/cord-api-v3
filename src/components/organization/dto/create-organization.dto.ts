import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { Organization } from './organization.dto';

@InputType()
export abstract class CreateOrganization {
  @NameField()
  readonly name: string;

  @NameField({ nullable: true })
  readonly acronym?: string | null;

  @Field({ nullable: true })
  readonly address?: string;
}

@InputType()
export abstract class CreateOrganizationInput {
  @Field()
  @Type(() => CreateOrganization)
  @ValidateNested()
  readonly organization: CreateOrganization;
}

@ObjectType()
export abstract class CreateOrganizationOutput {
  @Field()
  readonly organization: Organization;
}
