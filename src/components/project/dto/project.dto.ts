import { Type } from '@nestjs/common';
import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { MergeExclusive } from 'type-fest';
import {
  DateTimeField,
  Resource,
  SecuredDate,
  SecuredString,
  Sensitivity,
} from '../../../common';
import { SecuredCountry } from '../../location';
import { ProjectStatus } from './status.enum';
import { SecuredProjectStep } from './step.enum';
import { ProjectType } from './type.enum';

export type AnyProject = MergeExclusive<TranslationProject, InternshipProject>;

@InterfaceType({
  resolveType: (val: Project) => {
    if (val.type === ProjectType.Translation) {
      return TranslationProject.classType;
    }
    if (val.type === ProjectType.Internship) {
      return InternshipProject.classType;
    }
    throw new Error('Could not resolve project type');
  },
})
export class Project extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Project as any) as Type<Project>;

  @Field(() => ProjectType)
  readonly type: ProjectType;

  @Field(() => Sensitivity)
  readonly sensitivity: Sensitivity;

  @Field()
  readonly name: SecuredString;

  @Field({
    description: 'The legacy department ID',
    deprecationReason: undefined, // Soon™
  })
  readonly deptId: SecuredString;

  @Field()
  readonly step: SecuredProjectStep;

  @Field(() => ProjectStatus)
  readonly status: ProjectStatus;

  @Field()
  readonly location: SecuredCountry;

  @Field()
  readonly mouStart: SecuredDate;

  @Field()
  readonly mouEnd: SecuredDate;

  @Field()
  readonly estimatedSubmission: SecuredDate;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}

@ObjectType({
  implements: [Project, Resource],
})
export class TranslationProject extends Project {
  /* TS wants a public constructor for "ClassType" */
  static classType = (TranslationProject as any) as Type<TranslationProject>;

  readonly type: ProjectType.Translation;
}

@ObjectType({
  implements: [Project, Resource],
})
export class InternshipProject extends Project {
  /* TS wants a public constructor for "ClassType" */
  static classType = (InternshipProject as any) as Type<InternshipProject>;

  readonly type: ProjectType.Internship;
}
