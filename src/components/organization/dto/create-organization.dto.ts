import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { Field, InputType, ObjectType } from 'type-graphql';
import { Organization } from './organization';

@InputType()
export abstract class CreateOrganization {
  @Field()
  @MinLength(2)
  readonly name: string;
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
