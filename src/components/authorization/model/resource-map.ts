import {
  FinancialReport,
  NarrativeReport,
  IPeriodicReport as PeriodicReport,
} from '../../periodic-report/dto';
import { ProjectChangeRequest } from '../../project-change-request/dto';
import { Story } from '../../story/dto';
import { User } from '../../user/dto';
import { Unavailability } from '../../user/unavailability/dto';
import { AssignableRoles } from '../dto/assignable-roles';
import { BetaFeatures } from '../dto/beta-features';

/** @deprecated Use {@link import('~/core').ResourcesHost.getMap} instead */
export const LegacyResourceMap = {
  PeriodicReport,
  FinancialReport,
  NarrativeReport,
  ProjectChangeRequest,
  Story,
  Unavailability,
  User,
  AssignableRoles,
  BetaFeatures,
} as const;
