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

  /**
   * Which kind of actor this session runs as — for writers that record one.
   *
   * `userId` holds a SystemAgent's id whenever the session resolved to an
   * agent rather than a person: an anonymous session (the Anonymous agent),
   * Ghost impersonation, or `Identity.asSystemAgent`. All of those set
   * `systemAgentName`, which is what makes this discriminator work; the audit
   * writer discriminates on the same field.
   *
   * migration-todo: two session shapes slip past this discriminator, and in
   * both the failure lands on whatever consumes the id (e.g. a `users` FK):
   * 1. REACHABLE TODAY, over a request header: `resumeSession` resolves the
   *    Ghost agent only for the literal impersonatee id 'ghost'; a requester
   *    who sends a SystemAgent's REAL id gets `userId` = that agent with
   *    `systemAgentName` unset, so it reads as a person here. Nothing
   *    validates that the impersonatee is a live user.
   * 2. Unreachable today: `SessionManager.asRole` fabricates
   *    `userId: 'anonymous'` with no `systemAgentName`; both call sites are
   *    read-only permission serializers.
   * The fix belongs in session creation — validate or classify there (treat an
   * id that is not a live user as an agent, or fail with a domain error naming
   * the session shape) — not in each consumer.
   */
  get actor():
    | { type: 'user'; id: ID<'User'> }
    | { type: 'agent'; id: ID<'SystemAgent'> } {
    return this.systemAgentName
      ? { type: 'agent', id: this.userId as ID<'SystemAgent'> }
      : { type: 'user', id: this.userId as ID<'User'> };
  }

  get isAdmin() {
    return this.roles.has('Administrator');
  }

  isSelf(id: ID<'User'>) {
    return id === this.userId;
  }
}
