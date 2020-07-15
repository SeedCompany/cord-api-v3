import { Field, InputType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@InputType()
export class RemoveUserFromSecurityGroup {
  @IdField()
  readonly sgId: string;

  @IdField()
  readonly userId: string;
}

@InputType()
export abstract class RemoveUserFromSecurityGroupInput {
  @Field()
  readonly request: RemoveUserFromSecurityGroup;
}
