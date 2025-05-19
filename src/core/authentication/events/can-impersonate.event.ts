import { type PollVoter, type Session } from '~/common';

export class CanImpersonateEvent {
  constructor(readonly session: Session, readonly allow: PollVoter<boolean>) {}
}
