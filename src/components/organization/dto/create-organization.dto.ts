import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { MailingAddress } from '../../mailing-address';
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
  @Type(() => MailingAddress)
  @ValidateNested()
  readonly address?: MailingAddress;

  @Field(() => [OrganizationType], { nullable: true })
  readonly types?: readonly OrganizationType[];

  @Field(() => [OrganizationReach], { nullable: true })
  readonly reach?: readonly OrganizationReach[];
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
