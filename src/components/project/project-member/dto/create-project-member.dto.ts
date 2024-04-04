import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, Role, UnsecuredDto } from '~/common';
import { Project } from '../../dto';
import { ProjectMember } from './project-member.dto';

@InputType()
export class CreateProjectMember {
  @IdField({
    description: 'A user ID',
  })
  readonly userId: ID;

  @IdField({
    description: 'A project ID',
  })
  readonly projectId: ID | UnsecuredDto<Project>;

  @Field(() => [Role], { nullable: true })
  readonly roles?: readonly Role[];
}

@InputType()
export abstract class CreateProjectMemberInput {
  @Field()
  @Type(() => CreateProjectMember)
  @ValidateNested()
  readonly projectMember: CreateProjectMember;
}

@ObjectType()
export abstract class CreateProjectMemberOutput {
  @Field()
  readonly projectMember: ProjectMember;
}
