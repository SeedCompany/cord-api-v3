import { ID } from '~/common';
import { LoaderFactory, OrderedNestDataLoader } from '~/core';
import { Outcome } from './dto';

@LoaderFactory(() => [Outcome])
export class OutcomeLoader extends OrderedNestDataLoader<Outcome> {
  async loadMany(_ids: readonly ID[]) {
    return [];
  }
}
