import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@InputType()
export class CreateSecurityGroup {
  @Field()
  readonly name: string;
}

@InputType()
export abstract class CreateSecurityGroupInput {
  @Field()
  readonly request: CreateSecurityGroup;
}

@ObjectType()
export class CreateSecurityGroupOutput {
  @Field()
  success: boolean;
  @IdField({ nullable: true })
  id: string | null;
}
