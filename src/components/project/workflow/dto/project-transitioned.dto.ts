import { Field, ObjectType } from '@nestjs/graphql';
import { ProjectMutation, ProjectStep } from '../../dto';
import { ProjectWorkflowEvent } from './workflow-event.dto';

@ObjectType({
  implements: [ProjectMutation],
  description: 'When a project has had a workflow transition applied',
})
export class ProjectTransitioned extends ProjectMutation {
  declare readonly __typename: 'ProjectTransitioned';

  @Field({
    description: 'The workflow event representing the transition change',
  })
  readonly event: ProjectWorkflowEvent;

  @Field(() => ProjectStep, {
    description: 'The previous project step before the transition was executed',
  })
  readonly from: ProjectStep;
}
