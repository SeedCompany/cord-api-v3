import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { NameField } from '~/common';
import { OrganizationReach } from './organization-reach.dto';
import { OrganizationType } from './organization-type.dto';
import { Organization } from './organization.dto';

@InputType()
export abstract class CreateOrganization {
  @NameField()
  readonly name: string;

  @NameField({ nullable: true })
  readonly acronym?: string | null;

  @Field({ nullable: true })
  readonly address?: string;

  @Field(() => [OrganizationType], { nullable: true })
  readonly types?: readonly OrganizationType[];

  @Field(() => [OrganizationReach], { nullable: true })
  readonly reach?: readonly OrganizationReach[];
}

@ObjectType()
export abstract class CreateOrganizationOutput {
  @Field()
  readonly organization: Organization;
}
