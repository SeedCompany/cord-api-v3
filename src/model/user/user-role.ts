import { Location } from '../location';
import { Role } from '../role';

export interface UserRole {
  role: Role;
  locations: Location[];
}
