import { Query } from 'cypher-query-builder';
import { inspect, InspectOptionsStylized } from 'util';
import { Many, ResourceShape } from '~/common';
import type { VariantOf } from '../../../prompts/dto/variant.dto';
import {
  AsCypherParams,
  Condition,
  IsAllowedParams,
} from '../../policy/conditions';

class VariantCondition<TResourceStatic extends ResourceShape<any>>
  implements Condition<TResourceStatic>
{
  constructor(readonly variants: ReadonlySet<VariantOf<TResourceStatic>>) {}

  isAllowed({ object }: IsAllowedParams<TResourceStatic>) {
    if (!object) {
      throw new Error("Needed object but wasn't given");
    }

    // TODO hand waving
    const current = object.variant as VariantOf<TResourceStatic>;

    return this.variants.has(current);
  }

  asCypherCondition(query: Query, _other: AsCypherParams<TResourceStatic>) {
    const variants = query.params.addParam([...this.variants], 'variants');
    return `node.variant = ${String(variants)}`; // TODO hand waving
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return `Variant(s) { ${[...this.variants].join(', ')} }`;
  }
}

/**
 * The following actions if the object is one of the given variants.
 */
export const variant = <TResourceStatic extends ResourceShape<any>>(
  ...variant: Array<Many<VariantOf<TResourceStatic>>>
) =>
  new VariantCondition<TResourceStatic>(
    new Set(variant.flat() as Array<VariantOf<TResourceStatic>>)
  );
