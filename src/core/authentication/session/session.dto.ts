import { type DateTime } from 'luxon';
import {
  DataObject,
  type ID,
  type Role,
  UnauthenticatedException,
} from '~/common';

class RawSession extends DataObject {
  readonly token: string;
  readonly issuedAt: DateTime;
  readonly userId: ID;
  readonly roles: Iterable<Role>;
  readonly anonymous: boolean;

  /**
   * The name of the SystemAgent {@link userId} refers to, when it refers to one
   * rather than to a User — anonymous sessions ('Anonymous') and ghost
   * impersonation ('Ghost').
   *
   * `userId` is typed plain `ID`, not `ID<'User'>`, exactly because of this
   * ambiguity. Resolving it needs the agent in hand, which only session
   * creation has, so the answer is recorded here instead of left for each
   * consumer to reconstruct by comparing ids.
   */
  readonly systemAgentName?: string;

  /**
   * The "real", requesting user's session, when they are impersonating.
   */
  readonly impersonator?: Session;
  /**
   * The user and/or role the requesting user is impersonating.
   */
  readonly impersonatee?: {
    id?: ID;
    roles: ReadonlySet<Role>;
  };
}

export class Session extends RawSession {
  declare readonly roles: ReadonlySet<Role>;

  static from(session: RawSession): Session {
    return Object.assign(Session.defaultValue(Session), session, {
      roles: new Set(session.roles),
    });
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
    return this.roles.has('Administrator');
  }

  isSelf(id: ID<'User'>) {
    return id === this.userId;
  }
}
