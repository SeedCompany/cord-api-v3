import { Sensitivity } from '../../../common';

export type DbPermission = Partial<
  Record<Action, boolean> & Record<'sensitivityAccess', Sensitivity>
>;

export type Action = 'read' | 'write' | 'create' | 'delete' | 'admin';

export const rw = { read: true, write: true };
export const ro = { read: true };
