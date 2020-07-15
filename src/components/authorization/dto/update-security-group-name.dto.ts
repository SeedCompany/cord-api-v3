import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@InputType()
export class UpdateSecurityGroupName {
  @IdField()
  readonly id: string;

  @Field()
  readonly name: string;
}

@InputType()
export abstract class UpdateSecurityGroupNameInput {
  @Field()
  readonly request: UpdateSecurityGroupName;
}

@ObjectType()
export class UpdateSecurityGroupNameOutput {
  @IdField()
  id: string;

  @Field()
  name: string;
}
