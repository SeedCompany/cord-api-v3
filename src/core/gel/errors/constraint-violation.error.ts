import { ConstraintViolationError } from 'gel';
import { LiteralUnion } from 'type-fest';
import type { AllResourceDBNames } from '~/core';
import { attributesOf } from './attributes';

export class MyConstraintViolationError extends ConstraintViolationError {
  private declare readonly orig: ConstraintViolationError;
  constructor(e: ConstraintViolationError) {
    // @ts-expect-error it is a private field
    const message: string = e._message;
    // @ts-expect-error it is a private field
    const query: string = e._query;
    // @ts-expect-error it is a private field
    const attrs: Map<number, Uint8Array> = e._attrs;
    super(message);
    Object.defineProperties(this, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      _query: { value: query, writable: true, configurable: true },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      _attrs: { value: attrs, writable: true, configurable: true },
      orig: { value: e, writable: true, configurable: true },
    });
  }

  get stack() {
    const stack = this.orig.stack!.replace(
      /^ConstraintViolationError:/,
      this.name + ':',
    );
    Object.defineProperty(this, 'stack', {
      writable: true,
      configurable: true,
    });
    return stack;
  }

  static cast(e: ConstraintViolationError) {
    const matches = attributesOf(e).details!.match(
      /^violated constraint '(?<constraint>.+)' on property '(?<property>.+)' of object type '(?<fqn>.+)'$/,
    );
    if (!matches) {
      throw new Error(`Could not parse constraint violation error`, {
        cause: e,
      });
    }
    const { fqn: objectFQN, property, constraint } = matches.groups!;

    const ctor =
      constraint === 'std::exclusive'
        ? ExclusivityViolationError
        : PointerConstraintViolationError;

    return Object.assign(new ctor(e), { objectFQN, property, constraint });
  }
}

export class PointerConstraintViolationError extends MyConstraintViolationError {
  readonly objectFQN: AllResourceDBNames;
  readonly property: string;
  readonly constraint: LiteralUnion<'std::exclusive' | 'std::regexp', string>;
}
export class ExclusivityViolationError extends PointerConstraintViolationError {}
