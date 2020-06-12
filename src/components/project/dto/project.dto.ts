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
import { SecuredBudget } from '../../budget';
import { SecuredEngagementList } from '../../engagement';
import { Directory } from '../../file';
import { SecuredCountry } from '../../location';
import { SecuredPartnershipList } from '../../partnership';
import { SecuredProjectMemberList } from '../project-member';
import { ProjectStatus } from './status.enum';
import { SecuredProjectStep } from './step.enum';
import { ProjectType } from './type.enum';

export type Project = MergeExclusive<TranslationProject, InternshipProject>;

@InterfaceType('Project', {
  resolveType: (val: IProject) => {
    //console.log(val);
    if (val.type === ProjectType.Translation) {
      return TranslationProject.classType;
    }
    if (val.type === ProjectType.Internship) {
      return InternshipProject.classType;
    }

    throw new Error('Could not resolve project type');
  },
})
export class IProject extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (IProject as any) as Type<IProject>;

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

  // Lazily attached in resolver
  @Field(() => String, { nullable: true })
  readonly avatarLetters?: never;

  // Lazily attached in resolver
  @Field(() => SecuredProjectMemberList, {
    description: 'The project members',
  })
  team?: never;

  // Lazily attached in resolver
  @Field(() => SecuredEngagementList)
  engagements?: never;

  // Lazily attached in resolver
  @Field(() => SecuredBudget)
  budget?: never;

  // Lazily attached in resolver
  @Field(() => SecuredPartnershipList)
  partnerships?: never;

  // Lazily attached in resolver
  @Field(() => Directory)
  rootDirectory?: never;
}

@ObjectType({
  implements: [IProject, Resource],
})
export class TranslationProject extends IProject {
  /* TS wants a public constructor for "ClassType" */
  static classType = (TranslationProject as any) as Type<TranslationProject>;

  readonly type: ProjectType.Translation;
}

@ObjectType({
  implements: [IProject, Resource],
})
export class InternshipProject extends IProject {
  /* TS wants a public constructor for "ClassType" */
  static classType = (InternshipProject as any) as Type<InternshipProject>;

  readonly type: ProjectType.Internship;
}
