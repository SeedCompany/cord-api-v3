import { Organization } from '../organization/organization';
import { Education } from './education';
import { KnownLanguage } from './known-language';
import { Unavailability } from './unavailability';
import { User } from './user';
import { UserRole } from './user-role';

export interface UserProfile extends User {
  roles: UserRole[];
  organizations: Organization[];
  phone: string | null;
  timeZone: string;
  unavailabilities: Unavailability[];
  picture: string | null;
  bio: string;
  education: Education[];
  skills: string[];
  knownLanguages: KnownLanguage[];
}
