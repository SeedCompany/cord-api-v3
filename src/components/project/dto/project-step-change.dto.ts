import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DateTimeField,
  DbLabel,
  ID,
  IdField,
  Secured,
  SecuredProps,
} from '../../../common';
import { User } from '../../user/dto';
import { IProject, Project } from './project.dto';
import { ProjectStep } from './step.enum';

@InputType()
export abstract class ProjectStepChangeInput {
  @IdField()
  id: ID;

  @IdField({ nullable: true })
  changeset?: ID;

  @Field(() => ProjectStep)
  step: ProjectStep;

  @Field(() => String, { nullable: true })
  comment?: string;
}

@ObjectType()
export abstract class ProjectStepChangeOutput {
  @Field(() => IProject)
  readonly project: Project;
}

@ObjectType()
export abstract class ProjectStepChange {
  static readonly Props: string[] = keysOf<ProjectStepChange>();
  static readonly SecuredProps: string[] =
    keysOf<SecuredProps<ProjectStepChange>>();
  static readonly Relations = {
    by: User,
  };

  @Field(() => ProjectStep)
  @DbLabel('ProjectStep')
  readonly step: ProjectStep;

  @Field(() => String, { nullable: true })
  readonly comment?: string | null;

  @DateTimeField()
  readonly createdAt: DateTime;

  readonly user: Secured<ID | null>;
}
