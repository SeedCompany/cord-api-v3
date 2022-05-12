import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { SecuredEnumList, SecuredProperty } from '../../../common';

export enum ProgressVarianceReason {
  //BEHIND
  SlowStart = 'SlowStart',
  DelayedActivities = 'DelayedActivities',
  DelayedHiring = 'DelayedHiring',
  Unrest = 'Unrest',
  DelayedPartnerReporting = 'DelayedPartnerReporting',
  PartnerOrgIssues = 'PartnerOrgIssues',

  // ON TRACK
  ProgressAsExpected = 'ProgressAsExpected',
  TeamMadeUpTime = 'TeamMadeUpTime',

  // AHEAD
  AheadOfSchedule = 'AheadOfSchedule',
  NewTeamFasterProgress = 'NewTeamFasterProgress',
}

registerEnumType(ProgressVarianceReason, {
  name: 'ProgressVarianceReason',
  valuesMap: {
    SlowStart: {
      description: stripIndent`
	      @group Behind
      @label Slow Start of Project
	`,
    },
    DelayedActivities: {
      description: stripIndent`
		  @group Behind
      @label Delayed Activities
	`,
    },
    DelayedHiring: {
      description: stripIndent`
		  @group Behind
      @label Delayed Hiring
	`,
    },
    Unrest: {
      description: stripIndent`
		  @group Behind
      @label Economic, Political, or Civil Instability/Unrest
	`,
    },
    DelayedPartnerReporting: {
      description: stripIndent`
		  @group Behind
      @label Late or Delayed Partner Reporting
	`,
    },
    PartnerOrgIssues: {
      description: stripIndent`
		  @group Behind
      @label Partner Organization Issues
	`,
    },
    ProgressAsExpected: {
      description: stripIndent`
		  @group On Track
      @label Progress As Expected
	`,
    },
    TeamMadeUpTime: {
      description: stripIndent`
		  @group On Track
      @label Team Made Up Time
	`,
    },
    AheadOfSchedule: {
      description: stripIndent`
		  @group Ahead
        @Activities Ahead of Schedule
	`,
    },
    NewTeamFasterProgress: {
      description: stripIndent`
		  @group Ahead
      @label New Team, Faster Progress
	`,
    },
  },
});

@ObjectType({
  description: SecuredProperty.descriptionFor('report period'),
})
export abstract class SecuredProgressVarianceReasons extends SecuredEnumList(
  ProgressVarianceReason,
  {
    nullable: true, // TODO: I think this is right, since this is an optional field depending on the variance, but would be nice to have a second opinion
  }
) {}
