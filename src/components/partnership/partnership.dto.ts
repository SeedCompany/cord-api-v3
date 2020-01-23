import {
  Field,
  ID,
  InputType,
  ObjectType,
} from 'type-graphql';

import { DateTime } from 'luxon';
import { DateField } from '../../common';
import { Organization } from '../organization';
import { PartnershipAgreementStatus } from './agreement-status';
import { PartnershipType } from './partnership-type';
import { Partnership } from './partnership';

// CREATE
@InputType()
export class CreatePartnershipInput {
  @Field(type => String, { nullable: true })
  agreementStatus: PartnershipAgreementStatus;

  @Field(type => String, { nullable: true })
  mouStatus: PartnershipAgreementStatus;

  @DateField({ nullable: true })
  mouStart: DateTime | null;

  @DateField({ nullable: true })
  mouEnd: DateTime | null;

  @Field(type => Organization, { nullable: true })
  organization: Organization;

  @Field(type => [PartnershipType], { nullable: true })
  types: PartnershipType;
}

@InputType()
export class CreatePartnershipInputDto {
  @Field(type => CreatePartnershipInput)
  partnership: CreatePartnershipInput;
}

@ObjectType()
export class CreatePartnershipOutput {
  @Field(type => String)
  id: string;

  @Field(type => String, { nullable: true })
  agreementStatus: PartnershipAgreementStatus;

  @Field(type => String, { nullable: true })
  mouStatus: PartnershipAgreementStatus;

  @DateField({ nullable: true })
  mouStart: DateTime | null;

  @DateField({ nullable: true })
  mouEnd: DateTime | null;

  @Field(type => Organization, { nullable: true })
  organization: Organization;

  @Field(type => [PartnershipType], { nullable: true })
  types: PartnershipType;
}

@ObjectType()
export class CreatePartnershipOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  partnership: CreatePartnershipOutput;

  constructor() {
    this.partnership = new CreatePartnershipOutput();
  }
}

// READ

@InputType()
export class ReadPartnershipInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class ReadPartnershipInputDto {
  @Field()
  partnership: ReadPartnershipInput;
}

@ObjectType()
export class ReadPartnershipOutput {
  @Field(type => String)
  id: string;

  @Field(type => String, { nullable: true })
  agreementStatus: PartnershipAgreementStatus;

  @Field(type => String, { nullable: true })
  mouStatus: PartnershipAgreementStatus;

  @DateField({ nullable: true })
  mouStart: DateTime | null;

  @DateField({ nullable: true })
  mouEnd: DateTime | null;

  @Field(type => Organization, { nullable: true })
  organization: Organization;

  @Field(type => [PartnershipType], { nullable: true })
  types: PartnershipType;
}

@ObjectType()
export class ReadPartnershipOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  partnership: ReadPartnershipOutput;

  constructor() {
    this.partnership = new ReadPartnershipOutput();
  }
}

// UPDATE

@InputType()
export class UpdatePartnershipInput {
  @Field(type => String)
  id: string;

  @Field(type => String, { nullable: true })
  agreementStatus: PartnershipAgreementStatus;

  @Field(type => String, { nullable: true })
  mouStatus: PartnershipAgreementStatus;

  @DateField({ nullable: true })
  mouStart: DateTime | null;

  @DateField({ nullable: true })
  mouEnd: DateTime | null;

  @Field(type => Organization, { nullable: true })
  organization: Organization;

  @Field(type => [PartnershipType], { nullable: true })
  types: PartnershipType;
}

@InputType()
export class UpdatePartnershipInputDto {
  @Field()
  partnership: UpdatePartnershipInput;
}

@ObjectType()
export class UpdatePartnershipOutput {
  @Field(type => String)
  id: string;

  @Field(type => String, { nullable: true })
  agreementStatus: PartnershipAgreementStatus;

  @Field(type => String, { nullable: true })
  mouStatus: PartnershipAgreementStatus;

  @DateField({ nullable: true })
  mouStart: DateTime | null;

  @DateField({ nullable: true })
  mouEnd: DateTime | null;

  @Field(type => Organization, { nullable: true })
  organization: Organization;

  @Field(type => [PartnershipType], { nullable: true })
  types: PartnershipType;
}

@ObjectType()
export class UpdatePartnershipOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  partnership: UpdatePartnershipOutput;

  constructor() {
    this.partnership = new UpdatePartnershipOutput();
  }
}

// DELETE

@InputType()
export class DeletePartnershipInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class DeletePartnershipInputDto {
  @Field()
  partnership: DeletePartnershipInput;
}

@ObjectType()
export class DeletePartnershipOutput {
  @Field(type => String)
  id: string;
}

@ObjectType()
export class DeletePartnershipOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  partnership: DeletePartnershipOutput;

  constructor() {
    this.partnership = new DeletePartnershipOutput();
  }
}

// LIST

@InputType()
export class ListPartnershipsInput {
  @Field(type => String, { nullable: true, defaultValue: '' })
  filter: string;
  @Field(type => Number, { nullable: true, defaultValue: 0 })
  page: number;
  @Field(type => Number, { nullable: true, defaultValue: 25 })
  count: number;
  @Field(type => String, { nullable: true, defaultValue: 'DESC' })
  order: string;
  @Field(type => String, { nullable: true, defaultValue: 'agreementStatus' })
  sort: string;
}

@InputType()
export class ListPartnershipsInputDto {
  @Field()
  query: ListPartnershipsInput;
}

@ObjectType()
export class ListPartnershipsOutput {
  @Field(type => Partnership, { nullable: true })
  partnership: Partnership;
}

@ObjectType()
export class ListPartnershipsOutputDto {
  @Field(type => [Partnership], { nullable: true }) // nullable in case of error
  partnerships: Partnership[];
  constructor() {
    this.partnerships = [];
  }
}
