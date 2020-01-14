import { DateTime } from 'luxon';
import { Budget } from '../budget/budget';
import { Language } from '../language/language';
import { Location } from '../location/location';
import { Sensitivity } from './sensitivity';
import { TeamMember } from '../user/team-member';
import { ProjectStatus } from './status';
import { Partnership } from '../partnership/partnership';
import { ProjectEngagement } from '../project-engagement/engagement';
import { Field, ID, ObjectType } from 'type-graphql';

@ObjectType()
export class Project implements IProject {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  deptId: string | null;

  @Field()
  status: ProjectStatus;

  @Field({ nullable: true })
  location: Location | null;

  /** A version of the location that a "non-authorized" user would see. */
  @Field({ nullable: true })
  publicLocation: Location | null;

  @Field({ nullable: true })
  mouStart: DateTime | null;

  @Field()
  mouEnd: DateTime | null;

  @Field(type => [Language])
  languages: Language[];

  @Field(type => [Partnership])
  partnerships: Partnership[];

  @Field()
  sensitivity: Sensitivity;

  @Field(type => [TeamMember])
  team: TeamMember[];

  @Field(type => [Budget])
  budgets: Budget[];

  @Field({ nullable: true })
  estimatedSubmission: DateTime | null;

  @Field(type => [ProjectEngagement])
  engagements: ProjectEngagement[];

  @Field()
  updatedAt: DateTime;

  static from(project: Project) {
    return Object.assign(new Project(), project);
  }
}
export interface IProject {
  id: string;
  name: string;
  deptId: string | null;
  status: ProjectStatus;
  location: Location | null;
  /** A version of the location that a "non-authorized" user would see. */
  publicLocation: Location | null;
  mouStart: DateTime | null;
  mouEnd: DateTime | null;
  languages: Language[];
  partnerships: Partnership[];
  sensitivity: Sensitivity;
  team: TeamMember[];
  budgets: Budget[];
  estimatedSubmission: DateTime | null;
  engagements: ProjectEngagement[];
  updatedAt: DateTime;
}
