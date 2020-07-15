import { Field, InputType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@InputType()
export class RemovePermissionFromSecurityGroup {
  @IdField()
  readonly id: string; // the id of the permission
  @IdField()
  readonly sgId: string; // the id to the Security group to add the permission to
  @IdField()
  readonly baseNodeId: string; // the id to the base node that has the property that is being given access to
}

@InputType()
export abstract class RemovePermissionFromSecurityGroupInput {
  @Field()
  readonly request: RemovePermissionFromSecurityGroup;
}
