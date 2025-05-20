import { type DateTime } from 'luxon';
import { DataObject } from '~/common';
import { type ID } from '~/common/id-field';
import { type ScopedRole } from '../../../components/authorization/dto';

class RawSession extends DataObject {
  readonly token: string;
  readonly issuedAt: DateTime;
  readonly userId: ID;
  readonly roles: readonly ScopedRole[];
  readonly anonymous: boolean;

  /**
   * The "real", requesting user's session, when they are impersonating.
   */
  readonly impersonator?: Session;
  /**
   * The user and/or role the requesting user is impersonating.
   */
  readonly impersonatee?: {
    id?: ID;
    roles: readonly ScopedRole[];
  };
}

export class Session extends RawSession {
  static from(session: RawSession): Session {
    return Session.defaultValue(Session, session);
  }

  with(next: Partial<RawSession>): Session {
    return Object.assign(Session.defaultValue(Session), this, next);
  }
}
