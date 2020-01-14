import { ObjectType, Field, InputType } from 'type-graphql';
import { DateTime } from 'luxon';
import { Budget } from '../budget/budget';
import { Language } from '../language/language';
import { Location } from '../location/location';
import { Partnership } from '../partnership/partnership';
import { Sensitivity } from './sensitivity';
import { TeamMember } from '../user/team-member';
import { ProjectEngagement } from '../project-engagement/engagement';
import { ProjectStatus } from './status';

// CREATE
@InputType()
export class CreateProjectInput {
  @Field(type => String)
  name: string;
}

@InputType()
export class CreateProjectInputDto {
  @Field()
  project: CreateProjectInput;
  
  @Field()
  deptId: string | null;
  
  @Field()
  status: ProjectStatus;
  
  /**
   * The possible statuses the current user can set the status to.
   * Replace with better workflow
   */
  @Field()
  possibleStatuses: ProjectStatus[];
  
  @Field()
  location: Location | null;
  
  /** A version of the location that a "non-authorized" user would see. */
  @Field()
  publicLocation: Location | null;
  
  @Field()
  mouStart: DateTime | null;
  
  @Field()
  mouEnd: DateTime | null;
  
  @Field()
  languages: Language[];
  
  @Field()
  partnerships: Partnership[];
  
  @Field()
  sensitivity: Sensitivity;
  
  @Field()
  team: TeamMember[];
  
  @Field()
  budgets: Budget[];
  
  @Field()
  estimatedSubmission: DateTime | null;
  
  @Field()
  engagements: ProjectEngagement[];
  
  @Field()
  updatedAt: DateTime;
}

@ObjectType()
export class CreateProjectOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class CreateProjectOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  project: CreateProjectOutput;

  constructor() {
    this.project = new CreateProjectOutput();
  }
}

// READ

@InputType()
export class ReadProjectInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class ReadProjectInputDto {
  @Field()
  project: ReadProjectInput;
}

@ObjectType()
export class ReadProjectOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class ReadProjectOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  project: ReadProjectOutput;

  constructor() {
    this.project = new ReadProjectOutput();
  }
}

// UPDATE

@InputType()
export class UpdateProjectInput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@InputType()
export class UpdateProjectInputDto {
  @Field()
  project: UpdateProjectInput;
}

@ObjectType()
export class UpdateProjectOutput {
  @Field(type => String)
  id: string;
  @Field(type => String)
  name: string;
}

@ObjectType()
export class UpdateProjectOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  project: UpdateProjectOutput;

  constructor() {
    this.project = new UpdateProjectOutput();
  }
}

// DELETE

@InputType()
export class DeleteProjectInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class DeleteProjectInputDto {
  @Field()
  project: DeleteProjectInput;
}

@ObjectType()
export class DeleteProjectOutput {
  @Field(type => String)
  id: string;
}

@ObjectType()
export class DeleteProjectOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  project: DeleteProjectOutput;

  constructor() {
    this.project = new DeleteProjectOutput();
  }
}
