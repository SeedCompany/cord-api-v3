import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField } from '../../../../common';
import { Role } from '../../../authorization';
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
  readonly projectId: ID;

  @Field(() => [Role], { nullable: true })
  readonly roles?: Role[];
}

@InputType()
export abstract class CreateProjectMemberInput {
  @IdField({
    description: 'The change object to associate these engagement changes with',
    nullable: true,
  })
  readonly changeset?: ID;

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
