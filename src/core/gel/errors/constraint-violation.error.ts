import { ConstraintViolationError } from 'gel';
import { LiteralUnion } from 'type-fest';
import type { AllResourceDBNames } from '~/core/resources';
import { attributesOf } from './attributes';
import { ExclusivityViolationError } from './exclusivity-violation.error';

declare module 'gel' {
  interface ConstraintViolationError {
    readonly objectFQN: AllResourceDBNames;
    readonly property: string;
    readonly constraint: LiteralUnion<'std::exclusive' | 'std::regexp', string>;
  }
}

export const enhanceConstraintError = (e: ConstraintViolationError) => {
  const matches = attributesOf(e).details!.match(
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
