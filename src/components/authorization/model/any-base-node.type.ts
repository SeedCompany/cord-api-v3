import { DbProject } from '../../project/model';
import { DbUser } from '../../user/model';

export type AnyBaseNode = DbProject & DbUser;
export type OneBaseNode = DbProject | DbUser;
