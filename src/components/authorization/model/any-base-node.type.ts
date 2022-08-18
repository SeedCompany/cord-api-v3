import { DbBudget } from '../../budget/model';
import { DbBudgetRecord } from '../../budget/model/budget-record.model.db';
import { DbCeremony } from '../../ceremony/model';
import {
  DbInternshipEngagement,
  DbLanguageEngagement,
  DbPublicationEngagement,
} from '../../engagement/model';
import { DbEthnoArt } from '../../ethno-art/model';
import { DbFieldRegion } from '../../field-region/model';
import { DbFieldZone } from '../../field-zone/model';
import { DbDirectory, DbFile } from '../../file/model';
import { DbFileVersion } from '../../file/model/file-version.model.db';
import { DbFilm } from '../../film/model';
import { DbFundingAccount } from '../../funding-account/model';
import { DbEthnologueLanguage, DbLanguage } from '../../language/model';
import { DbLiteracyMaterial } from '../../literacy-material/model';
import { DbLocation } from '../../location/model';
import { DbOrganization } from '../../organization/model';
import { DbPartner } from '../../partner/model';
import { DbPartnership } from '../../partnership/model';
import { DbPeriodicReport } from '../../periodic-report/model';
import { DbPost } from '../../post/model';
import { DbProduct } from '../../product/model';
import { DbProjectChangeRequest } from '../../project-change-request/model';
import { DbProject } from '../../project/model';
import { DbProjectMember } from '../../project/project-member/model';
import { DbSong } from '../../song/model';
import { DbStory } from '../../story/model';
import { DbEducation, DbUnavailability, DbUser } from '../../user/model';

export type AnyBaseNode = DbBudget &
  DbBudgetRecord &
  DbCeremony &
  DbDirectory &
  DbEducation &
  DbEthnoArt &
  DbEthnologueLanguage &
  DbFieldRegion &
  DbFieldZone &
  DbFile &
  DbFileVersion &
  DbFilm &
  DbFundingAccount &
  DbInternshipEngagement &
  DbLanguage &
  DbLanguageEngagement &
  DbLiteracyMaterial &
  DbLocation &
  DbOrganization &
  DbPartner &
  DbPartnership &
  DbPost &
  DbProduct &
  DbProject &
  DbProjectMember &
  DbPeriodicReport &
  DbProjectChangeRequest &
  DbPublicationEngagement &
  DbSong &
  DbStory &
  DbUnavailability &
  DbUser;
export type OneBaseNode =
  | DbBudget
  | DbBudgetRecord
  | DbCeremony
  | DbDirectory
  | DbEducation
  | DbEthnoArt
  | DbEthnologueLanguage
  | DbFieldRegion
  | DbFieldZone
  | DbFile
  | DbFileVersion
  | DbFilm
  | DbFundingAccount
  | DbInternshipEngagement
  | DbLanguage
  | DbLanguageEngagement
  | DbLiteracyMaterial
  | DbLocation
  | DbOrganization
  | DbPartner
  | DbPartnership
  | DbPost
  | DbProduct
  | DbProject
  | DbProjectMember
  | DbPeriodicReport
  | DbProjectChangeRequest
  | DbPublicationEngagement
  | DbSong
  | DbStory
  | DbUnavailability
  | DbUser;
