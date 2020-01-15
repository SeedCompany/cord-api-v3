import { DateTime } from 'luxon';
import { Role } from './role';
import { User } from './user';
import { ObjectType, InputType, Field, GraphQLISODateTime } from 'type-graphql';

@ObjectType()
@InputType('TeamMemberInput')
export class TeamMember {
  @Field(type => User, { nullable: true })
  user: User;

  @Field(type => [Role], { nullable: true })
  roles: Role[];

  @Field({ nullable: true })
  description: string;

  @Field({ nullable: true })
  editable: boolean;

  @Field(type => GraphQLISODateTime, { nullable: true })
  dateAdded: DateTime | null;

  static from(teamMember: TeamMember) {
    return Object.assign(new TeamMember(), teamMember);
  }
}

export interface TeamMember {
  user: User;
  roles: Role[];
  description: string;
  editable: boolean;
  dateAdded: DateTime | null;
}
