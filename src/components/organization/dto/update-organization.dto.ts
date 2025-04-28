import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, NameField, OptionalField } from '~/common';
import { OrganizationReach } from './organization-reach.dto';
import { OrganizationType } from './organization-type.dto';
import { Organization } from './organization.dto';

@InputType()
export abstract class UpdateOrganization {
  @IdField()
  readonly id: ID;

  @NameField({ optional: true })
  readonly name?: string;

  @NameField({ nullable: true })
  readonly acronym?: string | null;

  @Field(() => String, { nullable: true })
  readonly address?: string | null;

  @OptionalField(() => [OrganizationType])
  readonly types?: readonly OrganizationType[];

  @OptionalField(() => [OrganizationReach])
  readonly reach?: readonly OrganizationReach[];
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
