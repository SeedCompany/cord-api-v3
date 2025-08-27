import { type Polls } from '~/common';
import { type Session } from '../session/session.dto';

export class CanImpersonateHook {
  constructor(
    readonly session: Session,
    readonly allow: Polls.BallotBox<boolean>,
  ) {}
}
