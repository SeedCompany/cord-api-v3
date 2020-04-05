import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType } from 'type-graphql';

@InputType()
export abstract class GroupState {
  @Field(() => ID)
  readonly stateId: string;

  @Field(() => ID)
  readonly securityGroupId: string;
}

@InputType()
export abstract class GroupStateInput {
  @Field()
  @Type(() => GroupState)
  @ValidateNested()
  readonly groupState: GroupState;
}
