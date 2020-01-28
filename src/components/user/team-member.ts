import { DateTime } from 'luxon';
import { DateTimeField } from '../../common';
import { Role } from './role';
import { User } from '.';
import { ObjectType, InputType, Field } from 'type-graphql';

@ObjectType()
export class TeamMember {
  @Field(type => User, { nullable: true })
  user: User;

  @Field(type => [Role], { nullable: true })
  roles: Role[];

  @Field({ nullable: true })
  description: string;

  @Field({ nullable: true })
  editable: boolean;

  @DateTimeField({ nullable: true })
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
