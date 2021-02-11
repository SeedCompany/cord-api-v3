import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { MergeExclusive } from 'type-fest';
import {
  DateTimeField,
  Resource,
  Secured,
  SecuredDate,
  SecuredDateNullable,
  SecuredDateTime,
  SecuredProps,
  SecuredString,
  Sensitivity,
} from '../../../common';
import { Role } from '../../authorization/dto';
import { DbRole } from '../../authorization/model';
import { SecuredTags } from '../../language/dto/language.dto';
import { ProjectStatus } from './status.enum';
import { SecuredProjectStep } from './step.enum';
import { ProjectType } from './type.enum';

type AnyProject = MergeExclusive<TranslationProject, InternshipProject>;

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
class Project extends Resource {
  static readonly Props: string[] = keysOf<Project>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Project>>();

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

  readonly globalRoles: DbRole[];

  readonly membershipRoles: Role[];
}

// class name has to match schema name for interface resolvers to work.
// export as different names to maintain compatibility with our codebase.
export { Project as IProject, AnyProject as Project };

@ObjectType({
  implements: [Project, Resource],
})
export class TranslationProject extends Project {
  static readonly Props = keysOf<TranslationProject>();
  static readonly SecuredProps = keysOf<SecuredProps<TranslationProject>>();

  readonly type: ProjectType.Translation;
}

@ObjectType({
  implements: [Project, Resource],
})
export class InternshipProject extends Project {
  static readonly Props = keysOf<InternshipProject>();
  static readonly SecuredProps = keysOf<SecuredProps<InternshipProject>>();

  readonly type: ProjectType.Internship;
}
