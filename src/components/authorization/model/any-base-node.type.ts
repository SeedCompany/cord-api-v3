import { DbBudget } from '../../budget/model';
import { DbBudgetRecord } from '../../budget/model/budget-record.model.db';
import { DbCeremony } from '../../ceremony/model';
import {
  DbInternshipEngagement,
  DbLanguageEngagement,
} from '../../engagement/model';
import { DbDirectory, DbFile } from '../../file/model';
import { DbFileVersion } from '../../file/model/file-version.model.db';
import { DbFilm } from '../../film/model';
import { DbFundingAccount } from '../../funding-account/model';
import { DbEthnologueLanguage, DbLanguage } from '../../language/model';
import { DbLiteracyMaterial } from '../../literacy-material/model';
import { DbOrganization } from '../../organization/model';
import { DbPartner } from '../../partner/model';
import { DbPartnership } from '../../partnership/model';
import { DbProduct } from '../../product/model';
import { DbProject } from '../../project/model';
import { DbProjectMember } from '../../project/project-member/model';
import { DbEducation, DbUnavailability, DbUser } from '../../user/model';

export type AnyBaseNode = DbBudget &
  DbBudgetRecord &
  DbCeremony &
  DbDirectory &
  DbEducation &
  DbEthnologueLanguage &
  DbFile &
  DbFileVersion &
  DbFilm &
  DbFundingAccount &
  DbInternshipEngagement &
  DbLanguage &
  DbLanguageEngagement &
  DbLiteracyMaterial &
  DbOrganization &
  DbPartner &
  DbPartnership &
  DbProduct &
  DbProject &
  DbProjectMember &
  DbUnavailability &
  DbUser;
export type OneBaseNode =
  | DbBudget
  | DbBudgetRecord
  | DbCeremony
  | DbDirectory
  | DbEducation
  | DbEthnologueLanguage
  | DbFile
  | DbFileVersion
  | DbFilm
  | DbFundingAccount
  | DbInternshipEngagement
  | DbLanguage
  | DbLanguageEngagement
  | DbLiteracyMaterial
  | DbOrganization
  | DbPartner
  | DbPartnership
  | DbProduct
  | DbProject
  | DbProjectMember
  | DbUnavailability
  | DbUser;
