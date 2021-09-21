import { ServerException } from '../../../common';
import { Budget, BudgetRecord } from '../../budget/dto';
import { Ceremony } from '../../ceremony/dto';
import { Changeset } from '../../changeset/dto';
import {
  IEngagement as Engagement,
  InternshipEngagement,
  LanguageEngagement,
} from '../../engagement/dto';
import { FieldRegion } from '../../field-region/dto';
import { FieldZone } from '../../field-zone/dto';
import { Directory, File, FileVersion } from '../../file/dto';
import { Film } from '../../film/dto';
import { FundingAccount } from '../../funding-account/dto';
import { EthnologueLanguage, Language } from '../../language/dto';
import { LiteracyMaterial } from '../../literacy-material/dto';
import { Location } from '../../location/dto';
import { Organization } from '../../organization/dto';
import { Partner } from '../../partner/dto';
import { Partnership } from '../../partnership/dto';
import {
  FinancialReport,
  NarrativeReport,
  IPeriodicReport as PeriodicReport,
  ProgressReport,
} from '../../periodic-report/dto';
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
import { Song } from '../../song/dto';
import { Story } from '../../story/dto';
import { User } from '../../user/dto';
import { Education } from '../../user/education/dto';
import { Unavailability } from '../../user/unavailability/dto';

export const ResourceMap = {
  Budget,
  BudgetRecord,
  Ceremony,
  Changeset,
  Directory,
  Education,
  Engagement,
  EthnologueLanguage,
  FieldRegion,
  FieldZone,
  File,
  FileVersion,
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
  ProgressReport,
  ProjectChangeRequest,
  Song,
  Story,
  Unavailability,
  User,
} as const;
export type ResourceMap = typeof ResourceMap;

export const resourceFromName = (name: string) => {
  const resource = ResourceMap[name as keyof ResourceMap];
  if (!resource) {
    throw new ServerException(
      `Unable to determine resource from ResourceMap for type: ${name}`
    );
  }
  return resource;
};
