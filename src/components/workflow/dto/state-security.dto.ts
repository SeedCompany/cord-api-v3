import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField } from '../../../common';

@InputType()
export abstract class GroupState {
  @IdField()
  readonly stateId: ID;

  @IdField()
  readonly securityGroupId: ID;
}

@InputType()
export abstract class GroupStateInput {
  @Field()
  @Type(() => GroupState)
  @ValidateNested()
  readonly groupState: GroupState;
}
