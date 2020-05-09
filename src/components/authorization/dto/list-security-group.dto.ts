import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { SecurityGroup } from './security-group.dto';

@InputType()
export class ListSecurityGroupInput {
  @Field(() => ID)
  readonly userId: string;
}

@ObjectType()
export class ListSecurityGroupOutput {
  @Field(() => [SecurityGroup])
  items: SecurityGroup[];
}
