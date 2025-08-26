import { type PollVoter } from '~/common';
import { type Session } from '../session/session.dto';

export class CanImpersonateHook {
  constructor(readonly session: Session, readonly allow: PollVoter<boolean>) {}
}
