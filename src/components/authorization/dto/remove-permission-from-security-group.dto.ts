import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class RemovePermissionFromSecurityGroup {
  @Field(() => ID)
  readonly id: string; // the id of the permission
  @Field(() => ID)
  readonly sgId: string; // the id to the Security group to add the permission to
  @Field(() => ID)
  readonly baseNodeId: string; // the id to the base node that has the property that is being given access to
}

@InputType()
export abstract class RemovePermissionFromSecurityGroupInput {
  @Field()
  readonly request: RemovePermissionFromSecurityGroup;
}
