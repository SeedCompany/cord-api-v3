import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

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
