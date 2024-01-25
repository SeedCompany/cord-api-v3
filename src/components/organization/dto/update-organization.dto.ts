import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, NameField } from '../../../common';
import { OrganizationReach } from './organization-reach.dto';
import { OrganizationType } from './organization-type.dto';
import { Organization } from './organization.dto';

@InputType()
export abstract class UpdateOrganization {
  @IdField()
  readonly id: ID;

  @NameField({ nullable: true })
  readonly name?: string;

  @NameField({ nullable: true })
  readonly acronym?: string | null;

  @Field({ nullable: true })
  readonly address?: string;

  @Field({ nullable: true })
  readonly website?: string;

  @Field({ nullable: true })
  readonly socialMedia?: string;

  @Field(() => [OrganizationType], { nullable: true })
  readonly types?: readonly OrganizationType[];

  @Field(() => [OrganizationReach], { nullable: true })
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
