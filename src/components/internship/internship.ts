import { DateTime } from 'luxon';
import { Budget } from '../budget/budget';
import { Location } from '../location/location';

import { Sensitivity } from '../project/sensitivity';
import { TeamMember } from '../user/team-member';

import { InternshipStatus } from './status';
import { Partnership } from '../partnership/partnership';
import { InternshipEngagement } from '../internship-engagement/engagement';

export interface Internship extends EditableInternship {
  id: string;
  deptId: string | null;
  possibleStatuses: InternshipStatus[];
  publicLocation: Location | null;
  updatedAt: DateTime;
}

export interface EditableInternship {
  name: string;
  status: InternshipStatus;
  location: Location | null;
  mouStart: DateTime | null;
  mouEnd: DateTime | null;
  partnerships: Partnership[];
  sensitivity: Sensitivity;
  team: TeamMember[];
  budgets: Budget[];
  estimatedSubmission: DateTime | null;
  engagements: InternshipEngagement[];
}
