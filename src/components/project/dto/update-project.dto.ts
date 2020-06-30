import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CalendarDate, DateField, NameField } from '../../../common';
import { IProject, Project } from './project.dto';

@InputType()
export abstract class UpdateProject {
  @Field(() => ID)
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

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
export abstract class UpdateProjectInput {
  @Field()
  @Type(() => UpdateProject)
  @ValidateNested()
  readonly project: UpdateProject;
}

@ObjectType()
export abstract class UpdateProjectOutput {
  @Field(() => IProject)
  readonly project: Project;
}
