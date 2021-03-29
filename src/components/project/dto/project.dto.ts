import { Type } from '@nestjs/common';
import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { MergeExclusive } from 'type-fest';
import {
  DateTimeField,
  DbLabel,
  ID,
  IntersectionType,
  parentIdMiddleware,
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
import { Postable } from '../../post/postable/dto/postable.dto';
import { ProjectMember } from '../project-member/dto';
import { ProjectStatus } from './status.enum';
import { SecuredProjectStep } from './step.enum';
import { ProjectType } from './type.enum';

type AnyProject = MergeExclusive<TranslationProject, InternshipProject>;

const PinnablePostableResource: Type<
  Resource & Postable & Pinnable
> = IntersectionType(Resource, IntersectionType(Postable, Pinnable));

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
  implements: [Resource, Pinnable],
})
class Project extends PinnablePostableResource {
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
  };

  @Field(() => ProjectType)
  readonly type: ProjectType;

  @Field(() => Sensitivity)
  readonly sensitivity: Sensitivity;

  @Field()
  @DbLabel('ProjectName')
  readonly name: SecuredString;

  @Field({
    description: 'The legacy department ID',
  })
  @DbLabel('DepartmentId')
  readonly departmentId: SecuredString;

  @Field({
    middleware: [parentIdMiddleware],
  })
  @DbLabel('ProjectStep')
  readonly step: SecuredProjectStep;

  @Field(() => ProjectStatus)
  @DbLabel('ProjectStatus')
  readonly status: ProjectStatus;

  readonly primaryLocation: Secured<ID>;

  readonly marketingLocation: Secured<ID>;

  readonly fieldRegion: Secured<ID>;

  readonly owningOrganization: Secured<ID>;

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
  implements: [Project, Resource, Pinnable, Postable],
})
export class TranslationProject extends Project {
  static readonly Props = keysOf<TranslationProject>();
  static readonly SecuredProps = keysOf<SecuredProps<TranslationProject>>();

  readonly type: ProjectType.Translation;
}

@ObjectType({
  implements: [Project, Resource, Pinnable, Postable],
})
export class InternshipProject extends Project {
  static readonly Props = keysOf<InternshipProject>();
  static readonly SecuredProps = keysOf<SecuredProps<InternshipProject>>();

  readonly type: ProjectType.Internship;
}
