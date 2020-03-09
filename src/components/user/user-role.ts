import { InputType, ObjectType } from 'type-graphql';
import { Location } from '../location';
import { Role } from './role';

export interface UserRole {
  role: Role;
  locations: Location[];
}

@ObjectType()
@InputType('UserRoleInput')
export class UserRole {}
