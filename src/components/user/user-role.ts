import { Location } from '../location/location';
import { Role } from './role';
import { ObjectType } from 'type-graphql';

export interface UserRole {
  role: Role;
  locations: Location[];
}

@ObjectType()
export class UserRole{}