import { DateFilter } from '../../common/date-filter';
import { Language } from '../language';
import { Location } from '../location';
import { Sensitivity } from './sensitivity';

import { ProjectStatus } from './status';
import { User } from '../user';

export interface ProjectFilter extends DateFilter {
  status?: ProjectStatus[];
  languages?: Language[];
  location?: Location[];
  team?: User[];
  sensitivity?: Sensitivity[];
}
