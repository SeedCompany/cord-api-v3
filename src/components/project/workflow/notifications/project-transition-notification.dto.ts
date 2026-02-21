import { Field, InterfaceType } from '@nestjs/graphql';
import { type LinkTo } from '~/core/resources';
import { Notification } from '../../../notifications';
import { ProjectStep } from '../../dto';

@InterfaceType({
  implements: [Notification],
})
export abstract class ProjectTransitionNotification extends Notification {
  readonly workflowEvent: LinkTo<'ProjectWorkflowEvent'>;

  @Field(() => ProjectStep)
  readonly previousStep: ProjectStep;
}
