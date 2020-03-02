import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { DateTime } from 'luxon';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { DateField } from '../../../common';
import { Project } from './project.dto';

@InputType()
export abstract class UpdateProject {
  @Field(() => ID)
  readonly id: string;

  @Field({ nullable: true })
  @MinLength(2)
  readonly name?: string;

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
export abstract class UpdateProjectInput {
  @Field()
  @Type(() => UpdateProject)
  @ValidateNested()
  readonly project: UpdateProject;
}

@ObjectType()
export abstract class UpdateProjectOutput {
  @Field()
  readonly project: Project;
}
