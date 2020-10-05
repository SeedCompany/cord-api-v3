import { DbBudget } from '../../budget/model';
import { DbBudgetRecord } from '../../budget/model/budget-record.model.db';
import { DbCeremony } from '../../ceremony/model';
import { DbProject } from '../../project/model';
import { DbUser } from '../../user/model';

export type AnyBaseNode = DbBudget &
  DbBudgetRecord &
  DbCeremony &
  DbProject &
  DbUser;
export type OneBaseNode =
  | DbBudget
  | DbBudgetRecord
  | DbCeremony
  | DbProject
  | DbUser;
