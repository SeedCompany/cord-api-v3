import { DateFilter } from '../../model/date-filter';
import { Language } from '../language/language';
import { Location } from '../location/location';
import { Sensitivity } from './sensitivity';

import { ProjectStatus } from './status';
import { User } from '../user/user';

export interface ProjectFilter extends DateFilter {
  status?: ProjectStatus[];
  languages?: Language[];
  location?: Location[];
  team?: User[];
  sensitivity?: Sensitivity[];
}
