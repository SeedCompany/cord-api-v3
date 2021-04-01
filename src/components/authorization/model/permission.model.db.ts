import { Sensitivity } from '../../../common';

export type DbPermission = Partial<
  Record<Action, boolean> & Record<'sensitivityLevel', Sensitivity>
>;

type Action = 'read' | 'write' | 'create' | 'delete' | 'admin';

export const rw = { read: true, write: true };
export const ro = { read: true };
