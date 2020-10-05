import { DbProject, DbProject2 } from '../../project/model';

export type AnyBaseNode = DbProject & DbProject2;
export type OneBaseNode = DbProject | DbProject2;
