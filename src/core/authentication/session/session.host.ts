import { type OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { BehaviorSubject } from 'rxjs';
import { AsyncLocalStorageNoContextException } from '~/common';
import { NoSessionException } from './no-session.exception';
import { type Session } from './session.dto';

/**
 * A service holding the current session / user
 */
export class SessionHost implements OnModuleDestroy {
  private readonly als = new AsyncLocalStorage<
    BehaviorSubject<Session | undefined>
  >();

  /**
   * Retrieve the current session.
   *
   * If this call is not within a {@link withSession} stack, a server error is thrown.
   *
   * If there is no current session, a {@link NoSessionException} is thrown.
   */
  get current() {
    const value = this.current$.value;
    if (value) {
      return value;
    }
    throw new NoSessionException();
  }

  /**
   * Retrieve the current session or undefined.
   *
   * If this call is not within a {@link withSession} stack, a server error is thrown.
   */
  get currentMaybe() {
    return this.current$.value;
  }

  /**
   * Retrieve the current session subject.
   *
   * It must exist, meaning that this call is within a {@link withSession} stack.
   * This subject could still not (yet) have an actual session value.
   */
  get current$() {
    const subject = this.als.getStore();
    if (!subject) {
      throw new AsyncLocalStorageNoContextException(
        'A session context has not been declared',
      );
    }
    return subject;
  }

  /**
   * Retrieve the current session or undefined.
   *
   * This is allowed to be called outside a {@link withSession} stack
   * and will just return undefined.
   */
  get currentIfInCtx() {
    return this.als.getStore()?.value;
  }

  /**
   * Run a function with a given session.
   */
  withSession<R>(
    session: BehaviorSubject<Session | undefined> | Session | undefined,
    fn: () => R,
  ) {
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
