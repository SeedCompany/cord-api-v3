import { Field, ObjectType } from '@nestjs/graphql';
import { ID, IdField } from '~/common';
import { TransitionType } from '../../../project/dto';
import { ProjectStep } from '../../dto';

export { TransitionType };

@ObjectType()
export abstract class ProjectWorkflowTransition {
  @IdField()
  readonly id: ID;

  @Field(() => ProjectStep)
  readonly to: ProjectStep;

  @Field()
  readonly label: string;

  @Field(() => TransitionType)
  readonly type: TransitionType;
}
