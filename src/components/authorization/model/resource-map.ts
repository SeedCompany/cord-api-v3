import { User } from '../../user/dto';
import { Unavailability } from '../../user/unavailability/dto';
import { AssignableRoles } from '../dto/assignable-roles';
import { BetaFeatures } from '../dto/beta-features';

/** @deprecated Use {@link import('~/core').ResourcesHost.getMap} instead */
export const LegacyResourceMap = {
  Unavailability,
  User,
  AssignableRoles,
  BetaFeatures,
} as const;
