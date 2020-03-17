import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { CalendarDate, DateField } from '../../../common';
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
  readonly mouStart?: CalendarDate;

  @DateField({ nullable: true })
  readonly mouEnd?: CalendarDate;

  @DateField({ nullable: true })
  readonly estimatedSubmission?: CalendarDate;
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
