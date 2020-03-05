import { Type } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Field, ObjectType, InterfaceType } from 'type-graphql';
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

@InterfaceType()
export class Project extends Resource {
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
