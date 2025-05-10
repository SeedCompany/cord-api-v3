import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { BehaviorSubject } from 'rxjs';
import { type Session } from '~/common';
import { NoSessionException } from './no-session.exception';

/**
 * A service holding the current session / user
 */
export abstract class SessionHost {
  get current() {
    const value = this.current$.value;
    if (value) {
      return value;
    }
    throw new NoSessionException();
  }

  abstract get current$(): BehaviorSubject<Session | undefined>;

  abstract withSession<R>(
    session: BehaviorSubject<Session | undefined> | Session | undefined,
    fn: () => R,
  ): R;
}

@Injectable()
export class SessionHostImpl extends SessionHost implements OnModuleDestroy {
  private readonly als = new AsyncLocalStorage<
    BehaviorSubject<Session | undefined>
  >();

  get current$() {
    return (
      this.als.getStore() ?? new BehaviorSubject<Session | undefined>(undefined)
    );
  }

  withSession<R>(
    session: BehaviorSubject<Session | undefined> | Session | undefined,
    fn: () => R,
  ): R {
    const session$ =
      session instanceof BehaviorSubject
        ? session
        : new BehaviorSubject(session);
    return this.als.run(session$, fn);
  }

  onModuleDestroy() {
    this.als.disable();
  }
}
