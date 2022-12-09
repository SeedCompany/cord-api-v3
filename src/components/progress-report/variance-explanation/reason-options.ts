import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProgressReportVarianceExplanationReasonOptions {
  @Field(() => [String])
  readonly behind = [
    'Delayed activities/activities did not occur/slow start of project',
    'Team is being trained at start of project; they expect to catch up by end of project',
    'Delayed hiring and/or replacement of personnel',
    'Economic/political/civil instability or unrest',
    'Late or delayed partner reporting',
    'Partner organization issues: leadership/infrastructure',
    'Health issues with team members or their families',
    'Team member passed away',
    'Security breach/teams in hiding',
    'Unstable internet',
    'Checking delayed because translation consultants not available',
  ];

  @Field(() => [String])
  readonly onTime = [];

  @Field(() => [String])
  readonly ahead = [
    'Training/drafting/checking ahead of schedule',
    'Project plan set slower to accommodate new team, and new team made good progress',
    'Team is experienced and worked faster than anticipated',
  ];
}
