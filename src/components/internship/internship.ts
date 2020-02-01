import { DateTime } from 'luxon';
import { DateField } from '../../common';
import { Budget } from '../budget/budget';
import { Location } from '../location';
import { Sensitivity } from '../project/sensitivity';
import { TeamMember } from '../user/team-member';
import { InternshipStatus } from './status';
import { Partnership } from '../partnership/partnership';
import { InternshipEngagement } from '../internship-engagement/engagement';
import { ObjectType, InputType, Field } from 'type-graphql';

@ObjectType()
export class Internship {
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
