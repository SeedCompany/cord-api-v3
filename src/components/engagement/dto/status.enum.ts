import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum } from '../../../common';
import { ProjectStep } from '../../project/dto';

export enum EngagementStatus {
  InDevelopment = 'InDevelopment',
  DidNotDevelop = 'DidNotDevelop',

  Active = 'Active',

  DiscussingTermination = 'DiscussingTermination',
  DiscussingReactivation = 'DiscussingReactivation',
  DiscussingChangeToPlan = 'DiscussingChangeToPlan',
  DiscussingSuspension = 'DiscussingSuspension',

  FinalizingCompletion = 'FinalizingCompletion',
  ActiveChangedPlan = 'ActiveChangedPlan',
  Suspended = 'Suspended',

  Terminated = 'Terminated',
  Completed = 'Completed',
  Converted = 'Converted', // this is being used in DOMO & from v2 data. Keep?
}

registerEnumType(EngagementStatus, {
  name: 'EngagementStatus',
});

@ObjectType({
  description: SecuredEnum.descriptionFor('an engagement status'),
})
export class SecuredEngagementStatus extends SecuredEnum(EngagementStatus) {}

export enum EngagementTransitionType {
  Neutral = 'Neutral',
  Approve = 'Approve',
  Reject = 'Reject',
}
registerEnumType(EngagementTransitionType, {
  name: 'EngagementTransitionType',
});

@ObjectType()
export abstract class EngagementStatusTransition {
  @Field(() => EngagementStatus)
  to: EngagementStatus;

  @Field()
  label: string;

  @Field(() => EngagementTransitionType)
  type: EngagementTransitionType;

  @Field(() => [ProjectStep])
  projectStepRequirements: ProjectStep[];
}
