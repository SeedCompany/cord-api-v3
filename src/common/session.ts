import {
  createParamDecorator,
  ExecutionContext,
  PipeTransform,
  Type,
} from '@nestjs/common';
import { CONTROLLER_WATERMARK } from '@nestjs/common/constants.js';
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

export const LoggedInSession = () =>
  AnonSession({ transform: loggedInSession });

export const AnonSession =
  (...pipes: Array<Type<PipeTransform> | PipeTransform>): ParameterDecorator =>
  (...args) => {
    Context({ transform: sessionFromContext }, ...pipes)(...args);
    process.nextTick(() => {
      // Only set this metadata if it's a controller method.
      // Waiting for the next tick as class decorators execute after methods.
      if (Reflect.getMetadata(CONTROLLER_WATERMARK, args[0].constructor)) {
        HttpSession(...pipes)(...args);
        SessionWatermark(...args);
      }
    });
  };

// Using Nest's custom decorator so that we can pass pipes.
const HttpSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().session;
  },
);

const SessionWatermark: ParameterDecorator = (target, key) =>
  Reflect.defineMetadata('SESSION_WATERMARK', true, target.constructor, key!);

export const addScope = (session: Session, scope?: ScopedRole[]) => ({
  ...session,
  roles: uniq([...session.roles, ...(scope ?? [])]),
});

export const isAdmin = (session: Session) =>
  session.roles.includes('global:Administrator');
