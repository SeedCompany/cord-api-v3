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
