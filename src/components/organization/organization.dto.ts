import { ObjectType, Field, InputType } from 'type-graphql';
import { Organization } from './organization';

// CREATE
@InputType()
export class CreateOrganizationInput {
  @Field(type => String)
  name: string;
}

@InputType()
export class CreateOrganizationInputDto {
  @Field()
  organization: CreateOrganizationInput;
}

@ObjectType()
export class CreateOrganizationOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class CreateOrganizationOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  organization: CreateOrganizationOutput;

  constructor() {
    this.organization = new CreateOrganizationOutput();
  }
}

// READ

@InputType()
export class ReadOrganizationInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class ReadOrganizationInputDto {
  @Field()
  organization: ReadOrganizationInput;
}

@ObjectType()
export class ReadOrganizationOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class ReadOrganizationOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  organization: ReadOrganizationOutput;
  constructor() {
    this.organization = new ReadOrganizationOutput();
  }
}

// UPDATE

@InputType()
export class UpdateOrganizationInput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@InputType()
export class UpdateOrganizationInputDto {
  @Field()
  organization: UpdateOrganizationInput;
}

@ObjectType()
export class UpdateOrganizationOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class UpdateOrganizationOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  organization: UpdateOrganizationOutput;
  constructor() {
    this.organization = new UpdateOrganizationOutput();
  }
}

// DELETE

@InputType()
export class DeleteOrganizationInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class DeleteOrganizationInputDto {
  @Field()
  organization: DeleteOrganizationInput;
}

@ObjectType()
export class DeleteOrganizationOutput {
  @Field(type => String)
  id: string;
}

@ObjectType()
export class DeleteOrganizationOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  organization: DeleteOrganizationOutput;
  constructor() {
    this.organization = new DeleteOrganizationOutput();
  }
}

// LIST

@InputType()
export class ListOrganizationsInput {
  @Field(type => String, { nullable: true })
  filter: string;
  @Field(type => Number, { nullable: true })
  page: number;
  @Field(type => Number, { nullable: true })
  count: number;
  @Field(type => String, { nullable: true })
  order: string;
  @Field(type => String, { nullable: true })
  sort: string;
}

@InputType()
export class ListOrganizationsInputDto {
  @Field()
  query: ListOrganizationsInput;
}

@ObjectType()
export class ListOrganizationsOutput {
  @Field(type => Organization, { nullable: true })
  organization: Organization;
}

@ObjectType()
export class ListOrganizationsOutputDto {
  @Field(type => [Organization], { nullable: true }) // nullable in case of error
  organizations: Organization[];
  constructor() {
    this.organizations = [];
  }
}
