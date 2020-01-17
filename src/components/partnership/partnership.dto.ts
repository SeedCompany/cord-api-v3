import { InputType, Field, ID, GraphQLISODateTime, ObjectType } from 'type-graphql';
import { DateTime } from 'luxon';
import { PartnershipAgreementStatus } from './agreement-status';
import { Organization } from '../organization/organization';
import { PartnershipType } from './partnership-type';

// CREATE
@InputType()
export class CreatePartnershipInput {
  @Field(type => PartnershipAgreementStatus, { nullable: true })
  agreementStatus: PartnershipAgreementStatus;

  @Field(type => PartnershipAgreementStatus, { nullable: true })
  mouStatus: PartnershipAgreementStatus;
    
  @Field(type => GraphQLISODateTime, { nullable: true })
  mouStart: DateTime | null;;

  @Field(type => GraphQLISODateTime, { nullable: true })
  mouEnd: DateTime | null;;

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

  @Field(type => PartnershipAgreementStatus, { nullable: true })
  agreementStatus: PartnershipAgreementStatus;

  @Field(type => PartnershipAgreementStatus, { nullable: true })
  mouStatus: PartnershipAgreementStatus;
    
  @Field(type => GraphQLISODateTime, { nullable: true })
  mouStart: DateTime | null;;

  @Field(type => GraphQLISODateTime, { nullable: true })
  mouEnd: DateTime | null;;

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
  
    @Field(type => PartnershipAgreementStatus, { nullable: true })
    agreementStatus: PartnershipAgreementStatus;
  
    @Field(type => PartnershipAgreementStatus, { nullable: true })
    mouStatus: PartnershipAgreementStatus;
      
    @Field(type => GraphQLISODateTime, { nullable: true })
    mouStart: DateTime | null;;
  
    @Field(type => GraphQLISODateTime, { nullable: true })
    mouEnd: DateTime | null;;
  
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
  
    @Field(type => PartnershipAgreementStatus, { nullable: true })
    agreementStatus: PartnershipAgreementStatus;
  
    @Field(type => PartnershipAgreementStatus, { nullable: true })
    mouStatus: PartnershipAgreementStatus;
      
    @Field(type => GraphQLISODateTime, { nullable: true })
    mouStart: DateTime | null;;
  
    @Field(type => GraphQLISODateTime, { nullable: true })
    mouEnd: DateTime | null;;
  
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
  
    @Field(type => PartnershipAgreementStatus, { nullable: true })
    agreementStatus: PartnershipAgreementStatus;
  
    @Field(type => PartnershipAgreementStatus, { nullable: true })
    mouStatus: PartnershipAgreementStatus;
      
    @Field(type => GraphQLISODateTime, { nullable: true })
    mouStart: DateTime | null;;
  
    @Field(type => GraphQLISODateTime, { nullable: true })
    mouEnd: DateTime | null;;
  
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
