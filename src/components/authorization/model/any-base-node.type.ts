import { DbBudget } from '../../budget/model';
import { DbProject } from '../../project/model';
import { DbUser } from '../../user/model';

export type AnyBaseNode = DbProject & DbUser & DbBudget;
export type OneBaseNode = DbProject | DbUser | DbBudget;
