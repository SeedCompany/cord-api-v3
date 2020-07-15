import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IdField } from '../../../common';
import { SecurityGroup } from './security-group.dto';

@InputType()
export class ListSecurityGroupInput {
  @IdField()
  readonly userId: string;
}

@ObjectType()
export class ListSecurityGroupOutput {
  @Field(() => [SecurityGroup])
  items: SecurityGroup[];
}
