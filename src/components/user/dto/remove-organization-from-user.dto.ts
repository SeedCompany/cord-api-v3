import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type ID, IdField } from '~/common';
import { Partner } from '../../../components/partner/dto';

@InputType()
export class RemoveOrganizationFromUser {
  @IdField()
  readonly org: ID<'Organization'>;

  @IdField()
  readonly user: ID<'User'>;
}

@InputType()
export abstract class RemoveOrganizationFromUserInput {
  @Field()
  @Type(() => RemoveOrganizationFromUser)
  @ValidateNested()
  readonly assignment: RemoveOrganizationFromUser;
}

@ObjectType()
export abstract class RemoveOrganizationFromUserOutput {
  @Field()
  readonly partner: Partner;
}
