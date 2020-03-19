import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { Role } from '../../user/role';
import { ProjectMember } from './project-member.dto';

@InputType()
export class CreateProjectMember {
  @Field(() => ID, {
    description: 'A user ID',
  })
  readonly userId: string;

  @Field(() => ID, {
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
