import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { Grandparent, type ID, IdField } from '~/common';
import { AsUpdateType } from '~/common/as-update.type';
import { ProjectMutationOrDeletion } from '../../dto/project-mutations.dto';
import type { ProjectMember } from './project-member.dto';
import { UpdateProjectMember } from './update-project-member.dto';

@InterfaceType({ implements: [ProjectMutationOrDeletion] })
export class ProjectMemberMutationOrDeletion extends ProjectMutationOrDeletion {
  /** Why here? See {@link ProjectMutationOrDeletion.projectId} */
  @IdField()
  readonly memberId: ID<ProjectMember>;
}

@InterfaceType({ implements: [ProjectMemberMutationOrDeletion] })
export class ProjectMemberMutation extends ProjectMemberMutationOrDeletion {}

@ObjectType({ implements: [ProjectMemberMutation] })
export class ProjectMemberCreated extends ProjectMemberMutation {
  declare readonly __typename: 'ProjectMemberCreated';
}

@ObjectType()
export class ProjectMemberUpdate extends AsUpdateType(UpdateProjectMember, {
  omit: ['id'],
  links: [],
}) {}

@ObjectType({ implements: [ProjectMemberMutation] })
export class ProjectMemberUpdated extends ProjectMemberMutation {
  declare readonly __typename: 'ProjectMemberUpdated';

  @Field({ middleware: [Grandparent.store] })
  readonly previous: ProjectMemberUpdate;

  @Field({ middleware: [Grandparent.store] })
  readonly updated: ProjectMemberUpdate;
}

@ObjectType({ implements: [ProjectMemberMutationOrDeletion] })
export class ProjectMemberDeleted extends ProjectMemberMutationOrDeletion {
  declare readonly __typename: 'ProjectMemberDeleted';
}
