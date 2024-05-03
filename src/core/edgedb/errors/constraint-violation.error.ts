import { ConstraintViolationError } from 'edgedb';
import { LiteralUnion } from 'type-fest';
import type { AllResourceDBNames } from '~/core/resources';
import { ExclusivityViolationError } from './exclusivity-violation.error';

declare module 'edgedb' {
  interface ConstraintViolationError {
    readonly objectFQN: AllResourceDBNames;
    readonly property: string;
    readonly constraint: LiteralUnion<'std::exclusive' | 'std::regexp', string>;
  }
}

export const enhanceConstraintError = (e: ConstraintViolationError) => {
  // @ts-expect-error it is a private field
  const attrs: Map<number, Uint8Array> = e._attrs;

  const detail = new TextDecoder('utf8').decode(attrs.get(2 /* details */));
  const matches = detail.match(
    /^violated constraint '(?<constraint>.+)' on property '(?<property>.+)' of object type '(?<fqn>.+)'$/,
  );
  if (!matches) {
    throw new Error(`Could not parse constraint violation error`, { cause: e });
  }
  const { fqn, property, constraint } = matches.groups!;

  if (constraint === 'std::exclusive') {
    e = ExclusivityViolationError.cast(e);
  }

  return Object.assign(e, {
    objectFQN: fqn,
    property: property,
    constraint: constraint,
  });
};
