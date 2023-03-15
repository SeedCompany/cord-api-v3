import { Field, ObjectType } from '@nestjs/graphql';
import { LazyGetter as Once } from 'lazy-get-decorator';
import { DataObject, JsonSet } from '~/common';

@ObjectType()
export class ProgressReportVarianceExplanationReasonOptions extends DataObject {
  @Once() static get instance() {
    return ProgressReportVarianceExplanationReasonOptions.defaultValue(
      ProgressReportVarianceExplanationReasonOptions,
    );
  }

  @Once() get all(): ReadonlySet<string> {
    return new JsonSet([...this.behind, ...this.onTime, ...this.ahead]);
  }

  @Field(() => [String])
  readonly behind: ReadonlySet<string> = new JsonSet([
    'Delayed activities; activities did not occur; slow start of project',
    'Team is being trained at start of project; they expect to catch up by end of project',
    'Delayed hiring and/or replacement of personnel',
    'Economic/political/civil instability or unrest',
    'Late or delayed partner reporting',
    'Partner organization issues currently being addressed.',
    'Health issues with team members or their families',
    'Team member passed away',
    'Security breach/teams in hiding',
    'Unstable internet',
    'Checking delayed because translation consultants not available',
  ]);

  @Field(() => [String])
  readonly onTime: ReadonlySet<string> = new JsonSet([]);

  @Field(() => [String])
  readonly ahead: ReadonlySet<string> = new JsonSet([
    'Training/drafting/checking ahead of schedule',
    'Project plan set slower to accommodate new team, and new team made good progress',
    'Team is experienced and worked faster than anticipated',
  ]);
}
