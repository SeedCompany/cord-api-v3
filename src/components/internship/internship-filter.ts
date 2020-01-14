import { DateFilter } from '../../common/date-filter';
import { Location } from '../location/location';
import { Sensitivity } from '../project/sensitivity';

import { InternshipStatus } from './status';
import { User } from '../user/user';

export interface InternshipFilter extends DateFilter {
  status?: InternshipStatus[];
  location?: Location[];
  team?: User[];
  sensitivity?: Sensitivity[];
}
