import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { ProjectMember } from './project-member.dto';
import { Role } from './role.dto';

@InputType()
export abstract class UpdateProjectMember {
  @Field(() => ID)
  readonly id: string;

  @Field(() => [Role], { nullable: true })
  readonly roles?: Role[];
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
