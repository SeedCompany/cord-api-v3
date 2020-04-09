import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { Permission } from './permission.dto';

@InputType()
export class ListPermissionInput {
  @Field(() => ID)
  readonly sgId: string;
}

@ObjectType()
export class ListPermissionOutput {
  @Field(() => [Permission])
  items: Permission[];
}
