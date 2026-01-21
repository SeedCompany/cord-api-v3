import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type DateTime } from 'luxon';
import { DateTimeField, type ID, IdField, ListField, Role } from '~/common';
import { ProjectMember } from './project-member.dto';

@InputType()
export abstract class UpdateProjectMember {
  @IdField()
  readonly id: ID;

  @ListField(() => Role, { optional: true })
  readonly roles?: readonly Role[];

  @DateTimeField({
    nullable: true,
  })
  readonly inactiveAt?: DateTime | null;
}

@ObjectType()
export abstract class ProjectMemberUpdated {
  @Field()
  readonly projectMember: ProjectMember;
}
