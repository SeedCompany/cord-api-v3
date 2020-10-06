import { DbBudget } from '../../budget/model';
import { DbBudgetRecord } from '../../budget/model/budget-record.model.db';
import { DbCeremony } from '../../ceremony/model';
import { DbDirectory, DbFile } from '../../file/model';
import { DbFileVersion } from '../../file/model/file-version.model.db';
import { DbEthnologueLanguage, DbLanguage } from '../../language/model';
import { DbProject } from '../../project/model';
import { DbEducation, DbUnavailability, DbUser } from '../../user/model';

export type AnyBaseNode = DbBudget &
  DbBudgetRecord &
  DbCeremony &
  DbDirectory &
  DbEducation &
  DbEthnologueLanguage &
  DbFile &
  DbFileVersion &
  DbLanguage &
  DbProject &
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
  | DbLanguage
  | DbProject
  | DbUnavailability
  | DbUser;
