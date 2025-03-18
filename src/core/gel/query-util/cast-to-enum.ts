import { Merge } from 'type-fest';
import { $str } from '../generated-client/modules/std';
import { BaseType } from '../generated-client/typesystem';

/**
 * This is an unsafe helper to assert that the given str expression
 * is actually a string literal union of the given enum.
 *
 * @example
 * const expr = e.str('red') // edgeql str literal whose TS value is `string`
 * castToEnum(expr, ['red', 'blue']) // expression TS value is now `'red' | 'blue'`
 */
export const castToEnum = <Expr extends $el<$str>, const TS extends string>(
  expr: Expr,
  // eslint-disable-next-line @seedcompany/no-unused-vars
  tsValues: TS | Iterable<TS>,
) => expr as any as SetEl<Expr, $str<TS>>;

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions,@typescript-eslint/naming-convention
type $el<T> = { __element__: T };
type SetEl<T extends $el<BaseType>, NewType extends BaseType> = Merge<
  T,
  $el<NewType>
>;
