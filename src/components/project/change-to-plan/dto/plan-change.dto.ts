import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { TranslationProject } from '../..';
import { IdField } from '../../../../common';

export enum PlanChangeStep {
  Start = 'Start',
  End = 'End',
}

registerEnumType(PlanChangeStep, {
  name: 'PlanChangeStep',
});

@ObjectType()
export abstract class PlanChange {
  @IdField({
    description:
      'A change to project id. Each change request will have its own id.',
    nullable: false,
  })
  readonly changeId: string;

  @Field(() => TranslationProject)
  readonly project: TranslationProject;

  @Field(() => PlanChangeStep)
  readonly changeStep: PlanChangeStep;
}
