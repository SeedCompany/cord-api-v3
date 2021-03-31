import { Type } from '@nestjs/common';
import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { MergeExclusive } from 'type-fest';
import {
  DateTimeField,
  IntersectionType,
  Resource,
  Secured,
  SecuredDate,
  SecuredDateNullable,
  SecuredDateTime,
  SecuredProps,
  SecuredString,
  Sensitivity,
} from '../../../common';
import { ScopedRole } from '../../authorization/dto';
import { Budget } from '../../budget/dto';
import { IEngagement as Engagement } from '../../engagement/dto';
import { Directory } from '../../file/dto';
import { SecuredTags } from '../../language/dto/language.dto';
import { Location } from '../../location/dto';
import { Partnership } from '../../partnership/dto';
import { Pinnable } from '../../pin/dto';
import { Changeable, PlanChange } from '../change-to-plan/dto';
import { ProjectMember } from '../project-member/dto';
import { ProjectStatus } from './status.enum';
import { SecuredProjectStep } from './step.enum';
import { ProjectType } from './type.enum';

type AnyProject = MergeExclusive<TranslationProject, InternshipProject>;

const PinnableChangeableResource: Type<
  Resource & Changeable & Pinnable
> = IntersectionType(Resource, IntersectionType(Changeable, Pinnable));

@InterfaceType({
  resolveType: (val: Project) => {
    if (val.type === ProjectType.Translation) {
      return TranslationProject;
    }
    if (val.type === ProjectType.Internship) {
      return InternshipProject;
    }

    throw new Error('Could not resolve project type');
  },
})
class Project extends PinnableChangeableResource {
  static readonly Props: string[] = keysOf<Project>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Project>>();
  static readonly Relations = {
    rootDirectory: Directory,
    member: [ProjectMember], // why singular
    otherLocations: [Location],
    partnership: Partnership, // why singular
    budget: [Budget], // budgets or currentBudget?
    engagement: [Engagement], // why singular
    // edge case because it's writable for internships but not secured
    sensitivity: Sensitivity,
    planChange: PlanChange,
  };

  @Field(() => ProjectType)
  readonly type: ProjectType;

  @Field(() => Sensitivity)
  readonly sensitivity: Sensitivity;

  @Field()
  readonly name: SecuredString;

  @Field({
    description: 'The legacy department ID',
  })
  readonly departmentId: SecuredString;

  @Field()
  readonly step: SecuredProjectStep;

  @Field(() => ProjectStatus)
  readonly status: ProjectStatus;

  readonly primaryLocation: Secured<string>;

  readonly marketingLocation: Secured<string>;

  readonly fieldRegion: Secured<string>;

  readonly owningOrganization: Secured<string>;

  @Field()
  readonly mouStart: SecuredDate;

  @Field()
  readonly mouEnd: SecuredDate;

  @Field()
  // this should match project mouEnd, until it becomes active, then this is final.
  readonly initialMouEnd: SecuredDateNullable;

  @Field()
  readonly stepChangedAt: SecuredDateTime;

  @Field()
  readonly estimatedSubmission: SecuredDate;

  @DateTimeField()
  readonly modifiedAt: DateTime;

  @Field()
  readonly tags: SecuredTags;

  @Field()
  readonly financialReportReceivedAt: SecuredDateTime;

  // A list of non-global roles the requesting user has available for this object.
  // This is just a cache, to prevent extra db lookups within the same request.
  readonly scope: ScopedRole[];
}

// class name has to match schema name for interface resolvers to work.
// export as different names to maintain compatibility with our codebase.
export { Project as IProject, AnyProject as Project };

@ObjectType({
  implements: [Project, Resource, Pinnable, Changeable],
})
export class TranslationProject extends Project {
  static readonly Props = keysOf<TranslationProject>();
  static readonly SecuredProps = keysOf<SecuredProps<TranslationProject>>();

  readonly type: ProjectType.Translation;
}

@ObjectType({
  implements: [Project, Resource, Pinnable, Changeable],
})
export class InternshipProject extends Project {
  static readonly Props = keysOf<InternshipProject>();
  static readonly SecuredProps = keysOf<SecuredProps<InternshipProject>>();

  readonly type: ProjectType.Internship;
}
