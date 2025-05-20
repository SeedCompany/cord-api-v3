import { type DateTime } from 'luxon';
import { DataObject, type Role, UnauthenticatedException } from '~/common';
import { type ID } from '~/common/id-field';

class RawSession extends DataObject {
  readonly token: string;
  readonly issuedAt: DateTime;
  readonly userId: ID;
  readonly roles: readonly Role[];
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
    roles: readonly Role[];
  };
}

export class Session extends RawSession {
  static from(session: RawSession): Session {
    return Session.defaultValue(Session, session);
  }

  with(next: Partial<RawSession>): Session {
    return Object.assign(Session.defaultValue(Session), this, next);
  }

  /**
   * Manually verify the current requestor is logged in.
   */
  verifyLoggedIn() {
    if (this.anonymous) {
      throw new UnauthenticatedException('User is not logged in');
    }
  }

  get isAdmin() {
    return this.roles.includes('Administrator');
  }

  isSelf(id: ID<'User'>) {
    return id === this.userId;
  }
}
