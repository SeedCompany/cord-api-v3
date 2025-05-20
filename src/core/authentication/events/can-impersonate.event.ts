import { type PollVoter } from '~/common';
import { type Session } from '../session/session.dto';

export class CanImpersonateEvent {
  constructor(readonly session: Session, readonly allow: PollVoter<boolean>) {}
}
