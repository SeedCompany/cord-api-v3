import { DateTime } from 'luxon';
import { Role } from './role';
import { User } from './user';

export interface TeamMember {
  user: User;
  roles: Role[];
  description: string;
  editable: boolean;
  dateAdded: DateTime | null;
}
