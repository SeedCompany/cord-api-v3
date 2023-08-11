import { DateTime } from 'luxon';
import { ID, IdOf } from '~/common';

export type Raw<T> = T extends DateTime
  ? string
  : T extends IdOf<infer U>
  ? IdOf<U>
  : T extends ID
  ? ID
  : T extends Array<infer U>
  ? ReadonlyArray<Raw<U>>
  : T extends Record<string, any>
  ? { readonly [K in keyof T]: Raw<T[K]> }
  : T;
