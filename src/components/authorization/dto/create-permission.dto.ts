import { Field, InputType, ObjectType } from 'type-graphql';

@InputType()
export class CreatePermission {
  @Field()
  readonly subjectUserId: string; // the user who is receiving the new permission
  @Field()
  readonly aclId: string; // the id to the ACL to add the permission to
  @Field()
  readonly baseNodeId: string; // the id to the base node that has the property that is being given access to
  @Field()
  readonly propertyName: string; // the relationship type the schema uses to point to the property/proerties
}

@InputType()
export abstract class CreatePermissionInput {
  @Field()
  readonly request: CreatePermission;
}

@ObjectType()
export class CreatePermissionOutput {
  @Field()
  success: boolean;
}
