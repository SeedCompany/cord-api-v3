/* eslint-disable @seedcompany/no-unused-vars */

/**
 * Mark the decorator is disabled and give a reason why.
 * Allows to keep code versioned without being enabled
 * without all wall of commented out text that can get outdated.
 */
export const Disabled =
  (why: string, ...anything: unknown[]) =>
  (...decoratorArgs: unknown[]) => {
    // noop
  };
