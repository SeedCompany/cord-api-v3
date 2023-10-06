import { DataLoader } from '@seedcompany/data-loader';
import { NotFoundException } from './exceptions';
import { ID } from './id-field';
import { Secured, UnwrapSecured } from './secured-property';

/**
 * Map a secured value to something else.
 * The mapper is only called if `value` is truthy and `canRead` is true.
 */
export async function mapSecuredValue<T extends Secured<any>, S>(
  input: T,
  mapper: (unwrapped: NonNullable<UnwrapSecured<T>>) => Promise<S>,
): Promise<Secured<S>> {
  const { value, ...rest } = input;
  if (!rest.canRead || value == null) {
    return rest;
  }
  const mapped = await mapper(value);
  return { ...rest, value: mapped };
}

/**
 * A helper to hydrate a secured id list with a DataLoader.
 */
export async function loadSecuredIds<TID extends ID, Res>(
  loader: DataLoader<Res, ID>,
  input: Secured<readonly TID[]>,
): Promise<Required<Secured<readonly Res[]>>> {
  const { value: ids, ...rest } = input;
  const value = await loadManyIgnoreMissingThrowAny(loader, ids ?? []);
  return { ...rest, value };
}

/**
 * A helper to load many keys from a DataLoader,
 * ignoring missing keys and throwing any other errors.
 */
export async function loadManyIgnoreMissingThrowAny<Key, Res>(
  loader: DataLoader<Res, Key>,
  keys: readonly Key[],
): Promise<Required<readonly Res[]>> {
  const loaded = (await loader.loadMany(keys)).flatMap((item) => {
    if (item instanceof NotFoundException) {
      return [];
    } else if (item instanceof Error) {
      throw item;
    }

    return item;
  });
  return loaded;
}
