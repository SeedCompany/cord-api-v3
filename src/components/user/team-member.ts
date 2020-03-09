import { DateTime } from 'luxon';
import { Field, ObjectType } from 'type-graphql';
import { User } from '.';
import { DateTimeField } from '../../common';
import { Role } from './role';

@ObjectType()
export class TeamMember {
  @Field(() => User, { nullable: true })
  user: User;

  @Field(() => [Role], { nullable: true })
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
