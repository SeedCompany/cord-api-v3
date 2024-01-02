import { ConstraintViolationError } from 'edgedb';

export class ExclusivityViolationError extends ConstraintViolationError {
  constructor(
    readonly objectFQN: string,
    readonly property: string,
    message?: string,
    options?: {
      cause?: unknown;
    },
  ) {
    super(message, options);
  }

  static is(e: unknown): e is ConstraintViolationError {
    return (
      e instanceof ConstraintViolationError &&
      (e as any)._message.endsWith(' violates exclusivity constraint')
    );
  }

  static cast(e: ConstraintViolationError) {
    if (e instanceof ExclusivityViolationError) {
      return e;
    }

    // @ts-expect-error it's a private field
    const message: string = e._message;
    // @ts-expect-error it's a private field
    const query: string = e._query;
    // @ts-expect-error it's a private field
    const attrs: Map<number, Uint8Array> = e._attrs;

    const detail = new TextDecoder('utf8').decode(attrs.get(2 /* details */));
    const matches = detail.match(
      /^property '(.+)' of object type '(.+)' violates exclusivity constraint$/,
    );
    if (!matches) {
      throw new Error(
        `Could not parse exclusivity violation error; details: ${detail}`,
      );
    }
    const property = matches[1];
    const fqn = matches[2];
    const ex = new ExclusivityViolationError(fqn, property, message, {
      cause: e.cause,
    });

    ex.stack = e.stack!.replace(
      /^ConstraintViolationError:/,
      'ExclusivityViolationError:',
    );
    // @ts-expect-error it's a private field
    ex._query = query;
    // @ts-expect-error it's a private field
    ex._attrs = attrs;
    return ex;
  }
}
