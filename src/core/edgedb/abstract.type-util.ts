import { LiteralUnion } from 'type-fest';
import type * as $ from './generated-client/reflection';

/**
 * Loosen the object type to allow for extension
 */
export const abstractType = <T extends $.ObjectType>(
  obj: $.$expr_PathNode<$.TypeSet<T, $.Cardinality.Many>>,
): $.$expr_PathNode<
  $.TypeSet<
    $.ObjectType<
      // Keeping the type hint but allowing any string for name
      // since subtypes will have different names
      LiteralUnion<T['__name__'], string>,
      // No Change
      T['__pointers__'],
      // No Change
      T['__shape__']
      // Using default instead, to be compatible with subtypes
      // T['__exclusives__']
    >,
    $.Cardinality.Many
  >
> => obj as any;
