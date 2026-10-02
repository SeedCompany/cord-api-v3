import { type Sensitivity, type UnsecuredDto } from '~/common';
import { type ScopedRole } from '../authorization/dto/role.dto';

/**
 * A parent's membership and sensitivity, standing in as the privilege context
 * for a child that does not exist yet (a create check) or that has no row of
 * its own (the progress explanation). The member and sensitivity conditions
 * read exactly these two properties off whatever object they are given, so
 * this is the typed alternative to Momentum's `privileges.for(X, report as any)`.
 */
export const contextOf = <T extends object>(parent: {
  scope: readonly ScopedRole[];
  sensitivity: Sensitivity;
}): UnsecuredDto<T> => {
  const context: unknown = {
    scope: parent.scope,
    sensitivity: parent.sensitivity,
  };
  return context as UnsecuredDto<T>;
};
