import { type UnsecuredDto } from '~/common';
import { type Changeset } from '../dto';

/**
 * This changeset is in the process of becoming finalized.
 * Please attach to this event to determine how your objects should change.
 */
export class ChangesetFinalizingEvent<
  TChangeset extends Changeset = Changeset,
> {
  constructor(readonly changeset: UnsecuredDto<TChangeset>) {}
}
