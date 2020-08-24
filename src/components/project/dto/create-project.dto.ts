import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CalendarDate, DateField, IdField, NameField } from '../../../common';
import { IProject, Project } from './project.dto';
import { ProjectStep } from './step.enum';
import { ProjectType } from './type.enum';

@InputType()
export abstract class CreateProject {
  @NameField()
  readonly name: string;

  @Field(() => ProjectType)
  readonly type: ProjectType;

  @IdField({
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

  @Field(() => ProjectStep, { nullable: true })
  readonly step?: ProjectStep;
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
  @Field(() => IProject)
  readonly project: Project;
}
