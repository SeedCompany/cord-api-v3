import { Query } from 'cypher-query-builder';
import { inspect, InspectOptionsStylized } from 'util';
import { Many, ResourceShape, Variant, VariantOf } from '~/common';
import {
  AsCypherParams,
  Condition,
  eqlInLiteralSet,
  IsAllowedParams,
  MissingContextException,
} from '../../policy/conditions';

const VariantForCondition = Symbol('Variant');

export interface HasVariant {
  [VariantForCondition]: string;
}

export class VariantCondition<TResourceStatic extends ResourceShape<any>>
  implements Condition<TResourceStatic>
{
  constructor(readonly variants: ReadonlySet<VariantOf<TResourceStatic>>) {}

  isAllowed({ object }: IsAllowedParams<TResourceStatic>) {
    if (!object) {
      throw new MissingContextException();
    }

    const current = Reflect.get(
      object,
      VariantForCondition,
    ) as VariantOf<TResourceStatic>;

    return this.variants.has(current);
  }

  asCypherCondition(query: Query, _other: AsCypherParams<TResourceStatic>) {
    const variants = query.params.addParam([...this.variants], 'variants');
    return `node.variant = ${String(variants)}`;
  }

  asEdgeQLCondition() {
    return '<str>' + eqlInLiteralSet('.variant', this.variants);
  }

  union(this: void, conditions: this[]) {
    const variants = conditions.flatMap((cond) => [...cond.variants]);
    return new VariantCondition(new Set(variants));
  }

  intersect(this: void, conditions: this[]) {
    const variants = [...conditions[0].variants].filter((v) =>
      conditions.every((cond) => cond.variants.has(v)),
    );
    return new VariantCondition(new Set(variants));
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    return `Variant(s) { ${[...this.variants].join(', ')} }`;
  }
}

export const withVariant = <T extends object>(
  obj: T,
  variant: string | Variant,
) =>
  Object.defineProperty(obj, VariantForCondition, {
    value: typeof variant === 'string' ? variant : variant.key,
    enumerable: false,
    writable: true,
  }) as T & HasVariant;

/**
 * The following actions if the object is one of the given variants.
 */
export const variant = <TResourceStatic extends ResourceShape<any>>(
  ...variant: Array<Many<VariantOf<TResourceStatic>>>
) =>
  new VariantCondition<TResourceStatic>(
    new Set(variant.flat() as Array<VariantOf<TResourceStatic>>),
  );
