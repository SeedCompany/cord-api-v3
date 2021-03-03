import { Budget, BudgetRecord } from '../../budget/dto';
import { Ceremony } from '../../ceremony/dto';
import {
  IEngagement as Engagement,
  InternshipEngagement,
  LanguageEngagement,
} from '../../engagement/dto';
import { FieldRegion } from '../../field-region/dto';
import { FieldZone } from '../../field-zone/dto';
import { Film } from '../../film/dto';
import { FundingAccount } from '../../funding-account/dto';
import { EthnologueLanguage, Language } from '../../language/dto';
import { LiteracyMaterial } from '../../literacy-material/dto';
import { Location } from '../../location/dto';
import { Organization } from '../../organization/dto';
import { Partner } from '../../partner/dto';
import { Partnership } from '../../partnership/dto';
import {
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  Product,
} from '../../product/dto';
import {
  InternshipProject,
  IProject as Project,
  TranslationProject,
} from '../../project/dto';
import { ProjectMember } from '../../project/project-member/dto';
import { Song } from '../../song/dto';
import { Story } from '../../story/dto';
import { User } from '../../user/dto';
import { Education } from '../../user/education/dto';
import { Unavailability } from '../../user/unavailability/dto';

export const ResourceMap = {
  Budget,
  BudgetRecord,
  Ceremony,
  Education,
  Engagement,
  EthnologueLanguage,
  FieldRegion,
  FieldZone,
  Film,
  FundingAccount,
  InternshipEngagement,
  Language,
  LanguageEngagement,
  LiteracyMaterial,
  Location,
  Organization,
  Partner,
  Partnership,
  Product,
  DirectScriptureProduct,
  DerivativeScriptureProduct,
  Project,
  TranslationProject,
  InternshipProject,
  ProjectMember,
  Song,
  Story,
  Unavailability,
  User,
} as const;
export type ResourceMap = typeof ResourceMap;
