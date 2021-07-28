import { DateTime } from 'luxon';
import { ID } from './id-field';

interface ObjectViewTypeMap {
  active: true;
  deleted: true;
  changeset: ID | undefined;
  beforeChangeset: ID | undefined;
  asOf: DateTime;
}

type ObjToTypeValueUnion<T extends ObjectViewTypeMap> = {
  [K in keyof T]-?: { type: K; value: T[K] };
}[keyof T];

export type ObjectView = ObjToTypeValueUnion<ObjectViewTypeMap>;
