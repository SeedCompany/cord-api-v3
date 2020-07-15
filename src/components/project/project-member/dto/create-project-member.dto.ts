import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../../common';
import { ProjectMember } from './project-member.dto';
import { Role } from './role.dto';

@InputType()
export class CreateProjectMember {
  @IdField({
    description: 'A user ID',
  })
  readonly userId: string;

  @IdField({
    description: 'A project ID',
  })
  readonly projectId: string;

  @Field(() => [Role], { nullable: true })
  readonly roles?: Role[];
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
