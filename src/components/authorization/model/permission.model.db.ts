export type DbPermission = Partial<Record<Action, boolean>>;

type Action = 'read' | 'write' | 'create' | 'delete' | 'admin';

export const rw = { read: true, write: true };
export const ro = { read: true };
