import {
  lazyRecord as createLazyRecord,
  type EnhancedResource,
  type ResourceShape,
  type SecuredPropsPlusExtraKey,
} from '~/common';
import { type PropAction } from '../actions';
import { type Condition } from '../conditions';
import { action, extract, PermGranter } from './perm-granter';

export class PropGranter<
  TResourceStatic extends ResourceShape<any>,
> extends PermGranter<TResourceStatic, PropAction> {
  constructor(
    protected resource: EnhancedResource<TResourceStatic>,
    protected properties: Array<SecuredPropsPlusExtraKey<TResourceStatic>>,
    stagedCondition?: Condition<TResourceStatic>,
  ) {
    super(stagedCondition);
  }

  /**
   * The requester can read this.
   */
  get read() {
    return this[action]('read');
  }

  /**
   * The requester can read & modify this.
   */
  get edit() {
    return this[action]('read', 'edit');
  }

  [extract]() {
    return {
      ...super[extract](),
      resource: this.resource,
      properties: this.properties,
    };
  }

  static forResource<TResourceStatic extends ResourceShape<any>>(
    resource: EnhancedResource<TResourceStatic>,
    stagedCondition: Condition<TResourceStatic> | undefined,
  ): PropsGranter<TResourceStatic> {
    const granter = createLazyRecord<PropsGranter<TResourceStatic>>({
      getKeys: () => resource.securedPropsPlusExtra,
      calculate: (prop) =>
        prop === 'many'
          ? null // never hit
          : (new PropGranter(resource, [prop], stagedCondition) as any),
      // @ts-expect-error IDK why this is failing
      base: {
        many: (...props) => new PropGranter(resource, props, stagedCondition),
      },
    });
    return granter;
  }
}

export type PropsGranter<TResourceStatic extends ResourceShape<any>> = Record<
  SecuredPropsPlusExtraKey<TResourceStatic>,
  PropGranter<TResourceStatic>
> & {
  /**
   * A shortcut to apply actions to many properties at once.
   */
  many: (
    ...props: Array<SecuredPropsPlusExtraKey<TResourceStatic>>
  ) => PropGranter<TResourceStatic>;
};
