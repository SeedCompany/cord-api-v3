import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@InputType()
export class CreatePermission {
  @IdField()
  readonly sgId: string; // the id to the Security group to add the permission to
  @IdField()
  readonly baseNodeId: string; // the id to the base node that has the property that is being given access to
  @Field()
  readonly propertyName: string; // the relationship type the schema uses to point to the property/proerties

  @Field()
  readonly read: boolean;

  @Field()
  readonly write: boolean;
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
  @IdField({ nullable: true })
  id: string | null;
}
