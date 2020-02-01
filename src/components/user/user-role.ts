import { Location } from '../location';
import { Role } from './role';
import { ObjectType, InputType } from 'type-graphql';

export interface UserRole {
  role: Role;
  locations: Location[];
}

@ObjectType()
@InputType('UserRoleInput')
export class UserRole{}
