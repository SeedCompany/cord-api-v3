import { DateTime } from 'luxon';
import { Budget } from '../budget';
import { Location } from '../location';
import { Partnership } from '../partnerships';
import { Sensitivity } from '../sensitivity';
import { TeamMember } from '../team-member';
import { InternshipEngagement } from './engagement';
import { InternshipStatus } from './status';

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
