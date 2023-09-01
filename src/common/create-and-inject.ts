import { ModuleRef } from '@nestjs/core';
import { pickBy } from 'lodash';
import { Class } from 'type-fest';

/**
 * A helper to create an instance of a class and inject dependencies.
 */
export async function createAndInject<T extends Class<any>>(
  moduleRef: ModuleRef,
  type: T,
  ...input: ConstructorParameters<T>
): Promise<InstanceType<T>> {
  const injection = await moduleRef.resolve(type);
  const injectionProps = pickBy(injection);
  const object = new type(...input);
  Object.assign(object, injectionProps);
  return object;
}
