import { type Many } from '@seedcompany/common';
import type { MergeExclusive, Promisable } from 'type-fest';
import { type ID } from '~/common';

export interface TransitionNotifier<Params> {
  description: string;
  resolve: (params: Params) => Promisable<Many<Notifier>>;
}

export type Notifier = MergeExclusive<
  {
    id: ID<'User'>;
    email?: string | null;
  },
  {
    id?: ID<'User'> | null;
    email: string;
  }
>;
