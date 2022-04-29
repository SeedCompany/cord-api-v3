import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum, SecuredProperty } from '../../../common';

export enum ProgressVarianceReason {
  //BEHIND
  SlowStartOfProject = 'SlowStartOfProject',
  DelayedActivities = 'DelayedActivities',
  DelayedHiring = 'DelayedHiring',
  EconomicPoliticalOrCivilUnrest = 'EconomicPoliticalOrCivilUnrest',
  LateOrDelayedPartnerReporting = 'LateOrDelayedPartnerReporting',
  PartnerOrganizationIssues = 'PartnerOrganizationIssues',

  // ON TRACK
  ProgressAsExpected = 'ProgressAsExpected',
  TeamMadeUpTime = 'TeamMadeUpTime',

  // AHEAD
  ActivitiesAheadOfSchedule = 'ActivitiesAheadOfSchedule',
  NewTeamFasterProgress = 'NewTeamFasterProgress',
}

registerEnumType(ProgressVarianceReason, {
  name: 'ProgressVarianceReason',
  valuesMap: {
    SlowStartOfProject: {
      description: `@label Behind`,
    },
    DelayedActivities: {
      description: `@label Behind`,
    },
    DelayedHiring: {
      description: `@label Behind`,
    },
    EconomicPoliticalOrCivilUnrest: {
      description: `@label Behind`,
    },
    LateOrDelayedPartnerReporting: {
      description: `@label Behind`,
    },
    PartnerOrganizationIssues: {
      description: `@label Behind`,
    },
    ProgressAsExpected: {
      description: `@label On Track`,
    },
    TeamMadeUpTime: {
      description: `@label On Track`,
    },
    ActivitiesAheadOfSchedule: {
      description: `@label Ahead`,
    },
    NewTeamFasterProgress: {
      description: `@label Ahead`,
    },
  },
});

@ObjectType({
  description: SecuredProperty.descriptionFor('report period'),
})
export abstract class SecuredReportPeriod extends SecuredEnum(ReportPeriod, {
  nullable: true,
}) {}
