import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type ID, IdField, ListField, Role } from '~/common';
import { ProjectMember } from './project-member.dto';

@InputType()
export abstract class UpdateProjectMember {
  @IdField()
  readonly id: ID;

  @ListField(() => Role, { optional: true })
  readonly roles?: readonly Role[];
}

@InputType()
export abstract class UpdateProjectMemberInput {
  @Field()
  @Type(() => UpdateProjectMemberInput)
  @ValidateNested()
  readonly projectMember: UpdateProjectMember;
}

@ObjectType()
export abstract class UpdateProjectMemberOutput {
  @Field()
  readonly projectMember: ProjectMember;
}
