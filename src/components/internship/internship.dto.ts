import { ObjectType, Field, InputType, ID } from 'type-graphql';
import { DateTime } from 'luxon';
import { DateField } from '../../common';
import { Budget } from '../budget/budget';
import { Location } from '../location';
import { Partnership } from '../partnership/partnership';
import { Sensitivity } from '../project/sensitivity';
import { TeamMember } from '../user/team-member';
import { InternshipEngagement } from '../internship-engagement/engagement';
import { InternshipStatus } from './status';

// CREATE
@InputType()
export class CreateInternshipInput {
  @Field(type => String)
  name: string;

  @Field(type => String, { nullable: true })
  deptId: string | null;

  @Field(type => String, { nullable: true })
  publicLocation: Location | null;

  @Field(type => String, { nullable: true })
  status: InternshipStatus;

  @Field(() => ID, { nullable: true })
  locationId?: Location;

  @DateField({ nullable: true })
  mouStart: DateTime | null;

  @DateField({ nullable: true })
  mouEnd: DateTime | null;

  @Field(type => [Partnership], { nullable: true })
  partnerships: Partnership[];

  @Field(type => String, { nullable: true })
  sensitivity: Sensitivity;

  team: TeamMember[];

  budgets: Budget[];

  @DateField({ nullable: true })
  estimatedSubmission: DateTime | null;

  engagements: InternshipEngagement[];
}

@InputType()
export class CreateInternshipInputDto {
  @Field()
  internship: CreateInternshipInput;
}

@ObjectType()
export class CreateInternshipOutput {
  @Field(type => String)
  id: string;

  @Field(type => String)
  name: string;

  @Field(type => String, { nullable: true })
  deptId: string | null;

  @Field(type => String, { nullable: true })
  publicLocation: Location | null;

  @Field(type => String, { nullable: true })
  status: InternshipStatus;

  @Field(type => Location, { nullable: true })
  location: Location | null;

  @DateField({ nullable: true })
  mouStart: DateTime | null;

  @DateField({ nullable: true })
  mouEnd: DateTime | null;

  @Field(type => [Partnership], { nullable: true })
  partnerships: Partnership[];

  @Field(type => String, { nullable: true })
  sensitivity: Sensitivity;

  @Field(type => [TeamMember], { nullable: true })
  team: TeamMember[];

  @Field(type => [Budget], { nullable: true })
  budgets: Budget[];

  @DateField({ nullable: true })
  estimatedSubmission: DateTime | null;

  @Field(type => [InternshipEngagement], { nullable: true })
  engagements: InternshipEngagement[];

}

@ObjectType()
export class CreateInternshipOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  internship: CreateInternshipOutput;

  constructor() {
    this.internship = new CreateInternshipOutput();
  }
}

// READ

@InputType()
export class ReadInternshipInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class ReadInternshipInputDto {
  @Field()
  internship: ReadInternshipInput;
}

@ObjectType()
export class ReadInternshipOutput {
  @Field(type => String)
  id: string;

  @Field(type => String)
  name: string;

  @Field(type => String, { nullable: true })
  deptId: string | null;

  @Field(type => String, { nullable: true })
  publicLocation: Location | null;

  @Field(type => String, { nullable: true })
  status: InternshipStatus;

  @Field(type => Location, { nullable: true })
  location: Location | null;

  @DateField({ nullable: true })
  mouStart: DateTime | null;

  @DateField({ nullable: true })
  mouEnd: DateTime | null;

  @Field(type => [Partnership], { nullable: true })
  partnerships: Partnership[];

  @Field(type => String, { nullable: true })
  sensitivity: Sensitivity;

  @Field(type => [TeamMember], { nullable: true })
  team: TeamMember[];

  @Field(type => [Budget], { nullable: true })
  budgets: Budget[];

  @DateField({ nullable: true })
  estimatedSubmission: DateTime | null;

  @Field(type => [InternshipEngagement], { nullable: true })
  engagements: InternshipEngagement[];
}

@ObjectType()
export class ReadInternshipOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  internship: ReadInternshipOutput;

  constructor() {
    this.internship = new ReadInternshipOutput();
  }
}

// UPDATE

@InputType()
export class UpdateInternshipInput {
  @Field(type => String)
  id: string;

  @Field(type => String)
  name: string;

  @Field(type => String, { nullable: true })
  deptId: string | null;

  @Field(type => String, { nullable: true })
  publicLocation: Location | null;

  @Field(type => String, { nullable: true })
  status: InternshipStatus;

  @Field(() => ID, { nullable: true })
  locationId?: Location;

  @DateField({ nullable: true })
  mouStart: DateTime | null;

  @DateField({ nullable: true })
  mouEnd: DateTime | null;

  partnerships: Partnership[];

  @Field(type => String, { nullable: true })
  sensitivity: Sensitivity;

  team: TeamMember[];

  budgets: Budget[];

  @DateField({ nullable: true })
  estimatedSubmission: DateTime | null;

  engagements: InternshipEngagement[];
}

@InputType()
export class UpdateInternshipInputDto {
  @Field()
  internship: UpdateInternshipInput;
}

@ObjectType()
export class UpdateInternshipOutput {
  @Field(type => String)
  id: string;

  @Field(type => String)
  name: string;

  @Field(type => String, { nullable: true })
  deptId: string | null;

  @Field(type => String, { nullable: true })
  publicLocation: Location | null;

  @Field(type => String, { nullable: true })
  status: InternshipStatus;

  @Field(type => Location, { nullable: true })
  location: Location | null;

  @DateField({ nullable: true })
  mouStart: DateTime | null;

  @DateField({ nullable: true })
  mouEnd: DateTime | null;

  @Field(type => [Partnership], { nullable: true })
  partnerships: Partnership[];

  @Field(type => String, { nullable: true })
  sensitivity: Sensitivity;

  @Field(type => [TeamMember], { nullable: true })
  team: TeamMember[];

  @Field(type => [Budget], { nullable: true })
  budgets: Budget[];

  @DateField({ nullable: true })
  estimatedSubmission: DateTime | null;

  @Field(type => [InternshipEngagement], { nullable: true })
  engagements: InternshipEngagement[];
}

@ObjectType()
export class UpdateInternshipOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  internship: UpdateInternshipOutput;

  constructor() {
    this.internship = new UpdateInternshipOutput();
  }
}

// DELETE

@InputType()
export class DeleteInternshipInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class DeleteInternshipInputDto {
  @Field()
  internship: DeleteInternshipInput;
}

@ObjectType()
export class DeleteInternshipOutput {
  @Field(type => String)
  id: string;
}

@ObjectType()
export class DeleteInternshipOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  internship: DeleteInternshipOutput;

  constructor() {
    this.internship = new DeleteInternshipOutput();
  }
}
