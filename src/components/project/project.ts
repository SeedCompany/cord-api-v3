import { DateTime } from 'luxon';
import { Budget } from '../budget/budget';
import { Language } from '../language/language';
import { Location } from '../location/location';

import { Sensitivity } from './sensitivity';
import { TeamMember } from '../user/team-member';

import { ProjectStatus } from './status';
import { Partnership } from '../partnership/partnership';
import { ProjectEngagement } from '../project-engagement/engagement';

export interface Project {
  id: string;
  name: string;
  deptId: string | null;
  status: ProjectStatus;
  /**
   * The possible statuses the current user can set the status to.
   * Replace with better workflow
   */
  possibleStatuses: ProjectStatus[];
  location: Location | null;
  /** A version of the location that a "non-authorized" user would see. */
  publicLocation: Location | null;
  mouStart: DateTime | null;
  mouEnd: DateTime | null;
  languages: Language[];
  partnerships: Partnership[];
  sensitivity: Sensitivity;
  team: TeamMember[];
  budgets: Budget[];
  estimatedSubmission: DateTime | null;
  engagements: ProjectEngagement[];
  updatedAt: DateTime;
}
