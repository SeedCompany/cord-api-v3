import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, Role } from '~/common';
import { ProjectMember } from './project-member.dto';

@InputType()
export abstract class UpdateProjectMember {
  @IdField()
  readonly id: ID;

  @Field(() => [Role], { nullable: true })
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
