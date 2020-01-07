import { DateFilter } from '../date-filter';
import { Language } from '../language';
import { Location } from '../location';
import { Sensitivity } from '../sensitivity';
import { User } from '../user';
import { ProjectStatus } from './status';

export interface ProjectFilter extends DateFilter {
  status?: ProjectStatus[];
  languages?: Language[];
  location?: Location[];
  team?: User[];
  sensitivity?: Sensitivity[];
}
