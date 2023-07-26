import {
  FinancialReport,
  NarrativeReport,
  IPeriodicReport as PeriodicReport,
} from '../../periodic-report/dto';
import { Post } from '../../post/dto';
import {
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  OtherProduct,
  Producible,
  Product,
} from '../../product/dto';
import { ProjectChangeRequest } from '../../project-change-request/dto';
import {
  InternshipProject,
  IProject as Project,
  TranslationProject,
} from '../../project/dto';
import { ProjectMember } from '../../project/project-member/dto';
import { Story } from '../../story/dto';
import { User } from '../../user/dto';
import { Unavailability } from '../../user/unavailability/dto';
import { AssignableRoles } from '../dto/assignable-roles';
import { BetaFeatures } from '../dto/beta-features';

/** @deprecated Use {@link import('~/core').ResourcesHost.getMap} instead */
export const LegacyResourceMap = {
  Post,
  Producible,
  Product,
  DirectScriptureProduct,
  DerivativeScriptureProduct,
  OtherProduct,
  Project,
  TranslationProject,
  InternshipProject,
  ProjectMember,
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
