import { Field, InputType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@InputType()
export class AddPropertyToSecurityGroup {
  @IdField()
  readonly sgId: string;

  @Field()
  readonly property: string;
}

@InputType()
export abstract class AddPropertyToSecurityGroupInput {
  @Field()
  readonly request: AddPropertyToSecurityGroup;
}
