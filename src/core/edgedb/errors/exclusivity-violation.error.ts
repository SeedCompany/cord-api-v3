import { ConstraintViolationError } from 'edgedb';

export class ExclusivityViolationError extends ConstraintViolationError {
  static cast(e: ConstraintViolationError) {
    // @ts-expect-error it is a private field
    const message: string = e._message;
    // @ts-expect-error it is a private field
    const query: string = e._query;
    // @ts-expect-error it is a private field
    const attrs: Map<number, Uint8Array> = e._attrs;

    const ex = new ExclusivityViolationError(message);

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
