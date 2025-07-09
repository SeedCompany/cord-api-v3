import { Field, ID as IDType, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { type ID, IdField, IsId, NameField } from '~/common';
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

  @Field(() => [IDType], { nullable: true })
  @IsId({ each: true })
  @Transform(({ value }) => uniq(value))
  readonly joinedAlliances?: ReadonlyArray<ID<'AllianceMembership'>> = [];

  @Field(() => [IDType], { nullable: true })
  @IsId({ each: true })
  @Transform(({ value }) => uniq(value))
  readonly allianceMembers?: ReadonlyArray<ID<'AllianceMembership'>> = [];

  @IdField({ nullable: true })
  readonly parentId?: ID<'Organization'> | null;
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
