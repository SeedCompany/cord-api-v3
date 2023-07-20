import { Type } from '@nestjs/common';
import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { MergeExclusive } from 'type-fest';
import {
  DateInterval,
  DateTimeField,
  DbLabel,
  DbUnique,
  ID,
  IntersectionType,
  NameField,
  parentIdMiddleware,
  resolveByTypename,
  Resource,
  Secured,
  SecuredBoolean,
  SecuredDateNullable,
  SecuredDateTime,
  SecuredProps,
  SecuredString,
  SecuredStringNullable,
  Sensitivity,
  SensitivityField,
  UnsecuredDto,
} from '../../../common';
import { ScopedRole } from '../../authorization/dto';
import { Budget } from '../../budget/dto';
import { ChangesetAware } from '../../changeset/dto';
import { Commentable } from '../../comments';
import { IEngagement as Engagement } from '../../engagement/dto';
import { Directory } from '../../file/dto';
import { SecuredTags } from '../../language/dto/language.dto';
import { Location } from '../../location/dto';
import { Partnership } from '../../partnership/dto';
import { SecuredReportPeriod } from '../../periodic-report/dto';
import { Pinnable } from '../../pin/dto';
import { Postable } from '../../post/dto';
import { ProjectChangeRequest } from '../../project-change-request/dto';
import { ProjectMember } from '../project-member/dto';
import { ProjectStatus } from './status.enum';
import { SecuredProjectStep } from './step.enum';
import { ProjectType } from './type.enum';

type AnyProject = MergeExclusive<TranslationProject, InternshipProject>;

const Interfaces: Type<
  Resource & Postable & ChangesetAware & Pinnable & Commentable
> = IntersectionType(
  Resource,
  IntersectionType(
    Commentable,
    IntersectionType(Postable, IntersectionType(ChangesetAware, Pinnable)),
  ),
);

@InterfaceType({
  resolveType: (val: Project) => {
    if (val.type === ProjectType.Translation) {
      return TranslationProject;
    }
    if (val.type === ProjectType.Internship) {
      return InternshipProject;
    }
    return resolveByTypename(Project.name)(val);
  },
  implements: [Resource, Pinnable, Postable, ChangesetAware, Commentable],
})
class Project extends Interfaces {
  static readonly Props: string[] = keysOf<Project>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Project>>();
  static readonly Relations = {
    rootDirectory: Directory,
    member: [ProjectMember], // why singular
    otherLocations: [Location],
    partnership: [Partnership], // why singular
    budget: Budget, // currentBudget
    engagement: [Engagement], // why singular
    // edge case because it's writable for internships but not secured
    sensitivity: Sensitivity,
    ...Postable.Relations,
    changeRequests: [ProjectChangeRequest],
    ...Commentable.Relations,
  };

  @Field(() => ProjectType)
  readonly type: ProjectType;

  @SensitivityField()
  readonly sensitivity: Sensitivity;

  @NameField()
  @DbUnique()
  readonly name: SecuredString;

  @Field({
    description: 'The legacy department ID',
  })
  @DbUnique('DepartmentId')
  readonly departmentId: SecuredStringNullable;

  @Field({
    middleware: [parentIdMiddleware],
  })
  @DbLabel('ProjectStep')
  readonly step: SecuredProjectStep;

  @Field(() => ProjectStatus)
  @DbLabel('ProjectStatus')
  readonly status: ProjectStatus;

  readonly primaryLocation: Secured<ID | null>;

  readonly marketingLocation: Secured<ID | null>;

  readonly fieldRegion: Secured<ID | null>;

  readonly owningOrganization: Secured<ID | null>;

  @Field()
  readonly mouStart: SecuredDateNullable;

  @Field()
  readonly mouEnd: SecuredDateNullable;

  @Field()
  // this should match project mouEnd, until it becomes active, then this is final.
  readonly initialMouEnd: SecuredDateNullable;

  @Field()
  readonly stepChangedAt: SecuredDateTime;

  @Field()
  readonly estimatedSubmission: SecuredDateNullable;

  @DateTimeField()
  readonly modifiedAt: DateTime;

  @Field()
  readonly tags: SecuredTags;

  @Field()
  readonly financialReportReceivedAt: SecuredDateTime;

  @Field()
  readonly financialReportPeriod: SecuredReportPeriod;

  readonly rootDirectory: Secured<ID | undefined>;

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
   * Optimization for {@see ProjectResolver.engagements}.
   * This doesn't account for changesets or item filters.
   */
  readonly engagementTotal: number;

  // A list of non-global roles the requesting user has available for this object.
  // This is just a cache, to prevent extra db lookups within the same request.
  readonly scope: ScopedRole[];
}

// class name has to match schema name for interface resolvers to work.
// export as different names to maintain compatibility with our codebase.
export { Project as IProject, AnyProject as Project };

@ObjectType({
  implements: [Project],
})
export class TranslationProject extends Project {
  static readonly Props = keysOf<TranslationProject>();
  static readonly SecuredProps = keysOf<SecuredProps<TranslationProject>>();

  readonly type: ProjectType.Translation;
}

@ObjectType({
  implements: [Project],
})
export class InternshipProject extends Project {
  static readonly Props = keysOf<InternshipProject>();
  static readonly SecuredProps = keysOf<SecuredProps<InternshipProject>>();

  readonly type: ProjectType.Internship;
}

export const projectRange = (project: UnsecuredDto<Project>) =>
  DateInterval.tryFrom(project.mouStart, project.mouEnd);
