import { DateFilter } from '../date-filter';
import { Location } from '../location';
import { Sensitivity } from '../sensitivity';
import { User } from '../user';
import { InternshipStatus } from './status';

export interface InternshipFilter extends DateFilter {
  status?: InternshipStatus[];
  location?: Location[];
  team?: User[];
  sensitivity?: Sensitivity[];
}
