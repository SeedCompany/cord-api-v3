import { Context } from '@nestjs/graphql';
import { uniq } from 'lodash';
import { DateTime } from 'luxon';
import { NoSessionException } from '../components/authentication/no-session.exception';
import { ScopedRole } from '../components/authorization';
import { GqlContextType } from './context.type';
import { UnauthenticatedException } from './exceptions';
import { ID } from './id-field';

export interface Session {
  readonly token: string;
  readonly issuedAt: DateTime;
  readonly userId: ID;
  readonly roles: ScopedRole[];
  readonly anonymous: boolean;
}

export function loggedInSession(session: Session): Session {
  if (session.anonymous) {
    throw new UnauthenticatedException('User is not logged in');
  }
  return session;
}

const sessionFromContext = (context: GqlContextType) => {
  if (!context.session) {
    throw new NoSessionException();
  }
  return context.session;
};

export const AnonSession = () => Context({ transform: sessionFromContext });

export const LoggedInSession = () =>
  Context({ transform: sessionFromContext }, { transform: loggedInSession });

export const addScope = (session: Session, scope?: ScopedRole[]) => ({
  ...session,
  roles: uniq([...session.roles, ...(scope ?? [])]),
});

export const isAdmin = (session: Session) =>
  session.roles.includes('global:Administrator');
