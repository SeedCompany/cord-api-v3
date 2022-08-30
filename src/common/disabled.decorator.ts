/* eslint-disable @seedcompany/no-unused-vars */

type Decorator =
  | ClassDecorator
  | PropertyDecorator
  | MethodDecorator
  | ParameterDecorator;

/**
 * Mark the decorator is disabled and give a reason why.
 * Allows to keep code versioned without being enabled
 * without all wall of commented out text that can get outdated.
 */
export const Disabled =
  (why?: string) =>
  <T extends Decorator>(decorator: T): T =>
  // @ts-expect-error yeah all decorators can return void
  () => {
    // noop
  };
