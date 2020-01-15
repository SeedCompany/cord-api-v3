import { ObjectType, Field, InputType, GraphQLISODateTime } from 'type-graphql';
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

  @Field({ nullable: true })
  deptId: string | null;

  @Field({ nullable: true })
  status: ProjectStatus;

  @Field({ nullable: true })
  location: Location | null;

  /** A version of the location that a "non-authorized" user would see. */
  @Field({ nullable: true })
  publicLocation: Location | null;

  @Field(type => GraphQLISODateTime, { nullable: true })
  mouStart: DateTime | null;

  @Field(type => GraphQLISODateTime, { nullable: true })
  mouEnd: DateTime | null;

  @Field(type => [Language], { nullable: true })
  languages: Language[];

  @Field(type => [Partnership], { nullable: true })
  partnerships: Partnership[];

  @Field(type => Sensitivity, { nullable: true })
  sensitivity: Sensitivity;

  @Field(type => [TeamMember], { nullable: true })
  team: TeamMember[];

  @Field(type => [Budget], { nullable: true })
  budgets: Budget[];

  @Field(type => GraphQLISODateTime, { nullable: true })
  estimatedSubmission: DateTime | null;

  @Field(type => [ProjectEngagement], { nullable: true })
  engagements: ProjectEngagement[];
}

@InputType()
export class CreateProjectInputDto {
  @Field()
  project: CreateProjectInput;
}

@ObjectType()
export class CreateProjectOutput {
  @Field(type => String)
  id: string;

  @Field(type => String)
  name: string;

  @Field({ nullable: true })
  deptId: string | null;

  @Field({ nullable: true })
  status: ProjectStatus;

  @Field({ nullable: true })
  location: Location | null;

  /** A version of the location that a "non-authorized" user would see. */
  @Field({ nullable: true })
  publicLocation: Location | null;

  @Field(type => GraphQLISODateTime, { nullable: true })
  mouStart: DateTime | null;

  @Field(type => GraphQLISODateTime, { nullable: true })
  mouEnd: DateTime | null;

  @Field(type => [Language], { nullable: true })
  languages: Language[];

  @Field(type => [Partnership], { nullable: true })
  partnerships: Partnership[];

  @Field({ nullable: true })
  sensitivity: Sensitivity;

  @Field(type => [TeamMember], { nullable: true })
  team: TeamMember[];

  @Field(type => [Budget], { nullable: true })
  budgets: Budget[];

  @Field({ nullable: true })
  estimatedSubmission: DateTime | null;

  @Field(type => [ProjectEngagement], { nullable: true })
  engagements: ProjectEngagement[];

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

  @Field({ nullable: true })
  deptId: string | null;

  @Field({ nullable: true })
  status: ProjectStatus;

  @Field({ nullable: true })
  location: Location | null;

  /** A version of the location that a "non-authorized" user would see. */
  @Field({ nullable: true })
  publicLocation: Location | null;

  @Field(type => GraphQLISODateTime, { nullable: true })
  mouStart: DateTime | null;

  @Field(type => GraphQLISODateTime, { nullable: true })
  mouEnd: DateTime | null;

  @Field(type => [Language], { nullable: true })
  languages: Language[];

  @Field(type => [Partnership], { nullable: true })
  partnerships: Partnership[];

  @Field({ nullable: true })
  sensitivity: Sensitivity;

  @Field(type => [TeamMember], { nullable: true })
  team: TeamMember[];

  @Field(type => [Budget], { nullable: true })
  budgets: Budget[];

  @Field({ nullable: true })
  estimatedSubmission: DateTime | null;

  @Field(type => [ProjectEngagement], { nullable: true })
  engagements: ProjectEngagement[];
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

  @Field({ nullable: true })
  deptId: string | null;

  @Field({ nullable: true })
  status: ProjectStatus;

  @Field({ nullable: true })
  location: Location | null;

  /** A version of the location that a "non-authorized" user would see. */
  @Field({ nullable: true })
  publicLocation: Location | null;

  @Field(type => GraphQLISODateTime, { nullable: true })
  mouStart: DateTime | null;

  @Field(type => GraphQLISODateTime, { nullable: true })
  mouEnd: DateTime | null;

  @Field(type => [Language], { nullable: true })
  languages: Language[];

  @Field(type => [Partnership], { nullable: true })
  partnerships: Partnership[];

  @Field({ nullable: true })
  sensitivity: Sensitivity;

  @Field(type => [TeamMember], { nullable: true })
  team: TeamMember[];

  @Field(type => [Budget], { nullable: true })
  budgets: Budget[];

  @Field({ nullable: true })
  estimatedSubmission: DateTime | null;

  @Field(type => [ProjectEngagement], { nullable: true })
  engagements: ProjectEngagement[];
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

  @Field({ nullable: true })
  deptId: string | null;

  @Field({ nullable: true })
  status: ProjectStatus;

  @Field({ nullable: true })
  location: Location | null;

  /** A version of the location that a "non-authorized" user would see. */
  @Field({ nullable: true })
  publicLocation: Location | null;

  @Field(type => GraphQLISODateTime, { nullable: true })
  mouStart: DateTime | null;

  @Field(type => GraphQLISODateTime, { nullable: true })
  mouEnd: DateTime | null;

  @Field(type => [Language], { nullable: true })
  languages: Language[];

  @Field(type => [Partnership], { nullable: true })
  partnerships: Partnership[];

  @Field({ nullable: true })
  sensitivity: Sensitivity;

  @Field(type => [TeamMember], { nullable: true })
  team: TeamMember[];

  @Field(type => [Budget], { nullable: true })
  budgets: Budget[];

  @Field({ nullable: true })
  estimatedSubmission: DateTime | null;

  @Field(type => [ProjectEngagement], { nullable: true })
  engagements: ProjectEngagement[];
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
