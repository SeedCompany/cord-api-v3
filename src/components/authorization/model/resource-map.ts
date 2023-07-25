import { Changeset } from '../../changeset/dto';
import {
  IEngagement as Engagement,
  InternshipEngagement,
  LanguageEngagement,
} from '../../engagement/dto';
import { EthnoArt } from '../../ethno-art/dto';
import { FieldRegion } from '../../field-region/dto';
import { FieldZone } from '../../field-zone/dto';
import {
  Directory,
  File,
  IFileNode as FileNode,
  FileVersion,
} from '../../file/dto';
import { Film } from '../../film/dto';
import { FundingAccount } from '../../funding-account/dto';
import { EthnologueLanguage, Language } from '../../language/dto';
import { Organization } from '../../organization/dto';
import { Partner } from '../../partner/dto';
import { Partnership } from '../../partnership/dto';
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
import { Education } from '../../user/education/dto';
import { Unavailability } from '../../user/unavailability/dto';
import { AssignableRoles } from '../dto/assignable-roles';
import { BetaFeatures } from '../dto/beta-features';

/** @deprecated Use {@link import('~/core').ResourcesHost.getMap} instead */
export const LegacyResourceMap = {
  Changeset,
  Directory,
  Education,
  Engagement,
  EthnoArt,
  EthnologueLanguage,
  FieldRegion,
  FieldZone,
  File,
  FileNode,
  FileVersion,
  Film,
  FundingAccount,
  InternshipEngagement,
  Language,
  LanguageEngagement,
  Organization,
  Partner,
  Partnership,
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
