import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IdField } from '../../../common';
import { Permission } from './permission.dto';

@InputType()
export class ListPermissionInput {
  @IdField()
  readonly sgId: string;
}

@ObjectType()
export class ListPermissionOutput {
  @Field(() => [Permission])
  items: Permission[];
}
