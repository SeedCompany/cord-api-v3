import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { DateTime } from 'luxon';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { DateField } from '../../../common';
import { Project } from './project.dto';
import { ProjectType } from './type.enum';

@InputType()
export abstract class CreateProject {
  @Field()
  @MinLength(2)
  readonly name: string;

  @Field(() => ProjectType)
  readonly type: ProjectType;

  @Field(() => ID, {
    description: 'A country ID',
    nullable: true,
  })
  readonly locationId?: string;

  @DateField({ nullable: true })
  readonly mouStart?: DateTime;

  @DateField({ nullable: true })
  readonly mouEnd?: DateTime;

  @DateField({ nullable: true })
  readonly estimatedSubmission?: DateTime;
}

@InputType()
export abstract class CreateProjectInput {
  @Field()
  @Type(() => CreateProject)
  @ValidateNested()
  readonly project: CreateProject;
}

@ObjectType()
export abstract class CreateProjectOutput {
  @Field()
  readonly project: Project;
}
