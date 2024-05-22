import { Field, ObjectType } from '@nestjs/graphql';
import { EnumType, ID, IdField, makeEnum } from '~/common';
import { ProjectStep } from '../../dto';

export type TransitionType = EnumType<typeof TransitionType>;
export const TransitionType = makeEnum({
  name: 'TransitionType',
  values: ['Neutral', 'Approve', 'Reject'],
});

@ObjectType('ProjectStepTransition')
export abstract class ProjectWorkflowTransition {
  @IdField()
  readonly id: ID;

  @Field(() => ProjectStep)
  readonly to: ProjectStep;

  @Field()
  readonly label: string;

  @Field(() => TransitionType)
  readonly type: TransitionType;

  @Field(() => Boolean, { defaultValue: false })
  readonly disabled?: boolean;

  @Field(() => String, { nullable: true })
  readonly disabledReason?: string;
}
