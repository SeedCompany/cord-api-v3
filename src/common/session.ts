import { Context } from '@nestjs/graphql';
import { uniq } from 'lodash';
import { DateTime } from 'luxon';
import { NoSessionException } from '../components/authentication/no-session.exception';
import { ScopedRole } from '../components/authorization';
import { GqlContextType } from './context.type';
import { UnauthenticatedException } from './exceptions';
import { ID } from './id-field';

export interface RawSession {
  readonly token: string;
  readonly issuedAt: DateTime;
  readonly userId?: ID;
  readonly roles: ScopedRole[];
}

export interface Session extends Required<RawSession> {
  readonly anonymous: boolean;
}

export function loggedInSession(session: RawSession): Session {
  if (!session.userId) {
    throw new UnauthenticatedException('User is not logged in');
  }
  return {
    ...session,
    userId: session.userId,
    anonymous: false,
  };
}

export const anonymousSession = (session: RawSession): Session => ({
  ...session,
  userId: session.userId ?? ('anonuserid' as ID),
  anonymous: !session.userId,
});

const sessionFromContext = (context: GqlContextType) => {
  if (!context.session) {
    throw new NoSessionException();
  }
  return context.session;
};

export const AnonSession = () =>
  Context({ transform: sessionFromContext }, { transform: anonymousSession });

export const LoggedInSession = () =>
  Context({ transform: sessionFromContext }, { transform: loggedInSession });

export const addScope = (session: Session, scope?: ScopedRole[]) => ({
  ...session,
  roles: uniq([...session.roles, ...(scope ?? [])]),
});
