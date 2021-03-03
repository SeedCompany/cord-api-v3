import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { partition } from 'lodash';
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
  Converted = 'Converted',
  Unapproved = 'Unapproved',
  Transferred = 'Transferred',
  NotRenewed = 'NotRenewed',
  Rejected = 'Rejected',
}

const EngagementStatusTerminalMap: Record<EngagementStatus, boolean> = {
  [EngagementStatus.InDevelopment]: false,
  [EngagementStatus.DidNotDevelop]: true,
  [EngagementStatus.Active]: false,
  [EngagementStatus.DiscussingTermination]: false,
  [EngagementStatus.DiscussingReactivation]: false,
  [EngagementStatus.DiscussingChangeToPlan]: false,
  [EngagementStatus.DiscussingSuspension]: false,
  [EngagementStatus.FinalizingCompletion]: false,
  [EngagementStatus.ActiveChangedPlan]: false,
  [EngagementStatus.Suspended]: false,
  [EngagementStatus.Terminated]: true,
  [EngagementStatus.Completed]: true,
  [EngagementStatus.Converted]: true,
  [EngagementStatus.Unapproved]: true,
  [EngagementStatus.Transferred]: true,
  [EngagementStatus.NotRenewed]: true,
  [EngagementStatus.Rejected]: true,
};

export const [
  TerminalEngagementStatuses,
  NonTerminalEngagementStatuses,
] = partition(
  Object.keys(EngagementStatusTerminalMap) as EngagementStatus[],
  (k) => EngagementStatusTerminalMap[k]
);

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

  projectStepRequirements: ProjectStep[];
}
