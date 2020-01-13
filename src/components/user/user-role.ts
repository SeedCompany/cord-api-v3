import { Location } from '../location/location';
import { Role } from './role';

export interface UserRole {
  role: Role;
  locations: Location[];
}
