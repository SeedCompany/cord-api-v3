import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { simpleSwitch } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import { DateTime } from 'luxon';
import { type MergeExclusive } from 'type-fest';
import {
  Calculated,
  DateInterval,
  DateTimeField,
  DbLabel,
  DbSort,
  DbUnique,
  Disabled,
  EnhancedResource,
  Grandparent,
  IntersectTypes,
  NameField,
  RequiredWhen,
  Resource,
  type ResourceRelationsShape,
  type Secured,
  SecuredBoolean,
  SecuredDateNullable,
  SecuredDateTime,
  SecuredDateTimeNullable,
  SecuredString,
  SecuredStringNullable,
  Sensitivity,
  SensitivityField,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { sortingForEnumIndex } from '~/core/database/query';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { Budget } from '../../budget/dto';
import { ChangesetAware } from '../../changeset/dto';
import { Commentable } from '../../comments/dto';
import { IEngagement as Engagement } from '../../engagement/dto';
import { Directory } from '../../file/dto';
import { SecuredTags } from '../../language/dto';
import { Location } from '../../location/dto';
import { Partnership } from '../../partnership/dto';
import { SecuredReportPeriod } from '../../periodic-report/dto';
import { Pinnable } from '../../pin/dto';
import { Postable } from '../../post/dto';
import { ProjectChangeRequest } from '../../project-change-request/dto';
import { ProjectMember } from '../project-member/dto';
import { ProjectStatus } from './project-status.enum';
import { ProjectStep, SecuredProjectStep } from './project-step.enum';
import { ProjectType } from './project-type.enum';

type AnyProject = MergeExclusive<
  MomentumTranslationProject,
  MergeExclusive<MultiplicationTranslationProject, InternshipProject>
>;

const Interfaces = IntersectTypes(Resource, ChangesetAware, Pinnable, Postable, Commentable);

export const resolveProjectType = (val: Pick<AnyProject, 'type'>) => {
  const type = simpleSwitch(val.type, ProjectConcretes);
  if (!type) {
    throw new ServerException(`Could not resolve project type: '${val.type}'`);
  }
  return type;
};

const RequiredWhenNotInDev = RequiredWhen(() => Project)({
  description: 'the project is not in development',
  isEnabled: ({ status }) => status !== 'InDevelopment' && status !== 'DidNotDevelop',
});

@RegisterResource({ db: e.Project })
@InterfaceType({
  resolveType: resolveProjectType,
  implements: Interfaces.members,
})
class Project extends Interfaces {
  static readonly BaseNodeProps = [...EnhancedResource.of(Resource).props, 'type'];
  static readonly Relations = () =>
    ({
      rootDirectory: Directory,
      member: [ProjectMember], // why singular
      otherLocations: [Location],
      partnership: [Partnership], // why singular
      budget: Budget, // currentBudget
      engagement: [Engagement], // why singular
      // edge case because it's writable for internships but not secured
      sensitivity: undefined,
      ...Postable.Relations,
      changeRequests: [ProjectChangeRequest],
      ...Commentable.Relations,
    } satisfies ResourceRelationsShape);

  @Field(() => ProjectType)
  readonly type: ProjectType;

  @SensitivityField()
  readonly sensitivity: Sensitivity;

  @NameField()
  @DbUnique()
  readonly name: SecuredString;

  @Field({
    description: "The ID for Finance's departments",
  })
  @DbUnique('DepartmentId')
  readonly departmentId: SecuredStringNullable;

  @Field({
    middleware: [Grandparent.store],
  })
  @DbLabel('ProjectStep')
  @DbSort(sortingForEnumIndex(ProjectStep))
  @Calculated()
  readonly step: SecuredProjectStep;

  @Field(() => ProjectStatus)
  @DbLabel('ProjectStatus')
  @DbSort(sortingForEnumIndex(ProjectStatus))
  @Calculated()
  readonly status: ProjectStatus;

  readonly primaryPartnership: Secured<LinkTo<'Partnership'> | null>;

  @RequiredWhenNotInDev()
  readonly primaryLocation: Secured<LinkTo<'Location'> | null>;

  readonly marketingLocation: Secured<LinkTo<'Location'> | null>;

  readonly marketingRegionOverride: Secured<LinkTo<'Location'> | null>;
  readonly fieldRegion: Secured<LinkTo<'FieldRegion'> | null>;

  readonly owningOrganization: Secured<LinkTo<'Organization'> | null>;

  @Field()
  @RequiredWhenNotInDev()
  readonly mouStart: SecuredDateNullable;

  @Field()
  @RequiredWhenNotInDev()
  readonly mouEnd: SecuredDateNullable;

  @Field()
  // this should match project mouEnd, until it becomes active, then this is final.
  readonly initialMouEnd: SecuredDateNullable;

  @Field()
  @Calculated()
  readonly stepChangedAt: SecuredDateTime;

  @Field()
  readonly estimatedSubmission: SecuredDateNullable;

  @DateTimeField()
  readonly modifiedAt: DateTime;

  @Field()
  readonly tags: SecuredTags;

  @Field()
  readonly financialReportReceivedAt: SecuredDateTimeNullable;

  @Field()
  readonly financialReportPeriod: SecuredReportPeriod;

  readonly rootDirectory: Secured<LinkTo<'Directory'> | null>;

  @Field({
    description: 'Is the requesting user a member of this project?',
  })
  readonly isMember: boolean;

  @Field({
    description: stripIndent`
      Whether or not this project and its associated languages (via engagements)
      are a part of our "Preset Inventory".

      This indicates the project/language(s) will be exposed to major investors to directly fund.
      It also means the project is committed to having quality, consistent reporting.
    `,
  })
  readonly presetInventory: SecuredBoolean;

  /**
   * Optimization for {@link ProjectResolver.engagements}.
   * This doesn't account for changesets or item filters.
   */
  @Disabled(
    `
      I'm not convinced this wont have unintended consequences.
      it is still handled with the workflow condition currently and deletes are
      restricted, so this is a super edge case effectively.
    `,
    RequiredWhenNotInDev({
      field: 'engagements',
      isMissing: (project) => project.engagementTotal === 0,
    }),
  )
  readonly engagementTotal: number;
}

// class name has to match schema name for interface resolvers to work.
// export as different names to maintain compatibility with our codebase.
export { Project as IProject, type AnyProject as Project };

@RegisterResource({ db: e.TranslationProject })
@InterfaceType({
  resolveType: resolveProjectType,
  implements: [Project],
})
export class TranslationProject extends Project {
  declare readonly type: 'MultiplicationTranslation' | 'MomentumTranslation';
}

@RegisterResource({ db: e.MomentumTranslationProject })
@ObjectType({
  implements: [TranslationProject],
  description: 'Formerly known as our TranslationProjects',
})
export class MomentumTranslationProject extends TranslationProject {
  declare readonly type: 'MomentumTranslation';
}

@RegisterResource({ db: e.MultiplicationTranslationProject })
@ObjectType({
  implements: [TranslationProject],
})
export class MultiplicationTranslationProject extends TranslationProject {
  declare readonly type: 'MultiplicationTranslation';
}

@RegisterResource({ db: e.InternshipProject })
@ObjectType({
  implements: [Project],
})
export class InternshipProject extends Project {
  declare readonly type: 'Internship';
}

export const ProjectConcretes = {
  MomentumTranslation: MomentumTranslationProject,
  MultiplicationTranslation: MultiplicationTranslationProject,
  Internship: InternshipProject,
} as const satisfies Record<ProjectType, typeof Project>;

export const projectRange = (project: UnsecuredDto<Project>) =>
  DateInterval.tryFrom(project.mouStart, project.mouEnd);

declare module '~/core/resources/map' {
  interface ResourceMap {
    Project: typeof Project;
    InternshipProject: typeof InternshipProject;
    TranslationProject: typeof TranslationProject;
    MomentumTranslationProject: typeof MomentumTranslationProject;
    MultiplicationTranslationProject: typeof MultiplicationTranslationProject;
  }
  interface ResourceDBMap {
    Project: typeof e.default.Project;
    InternshipProject: typeof e.default.InternshipProject;
    TranslationProject: typeof e.default.TranslationProject;
    MomentumTranslationProject: typeof e.default.MomentumTranslationProject;
    MultiplicationTranslationProject: typeof e.default.MultiplicationTranslationProject;
  }
}
