import {
  EnhancedResource,
  mapFromList,
  ResourceShape,
  SecuredPropsAndSingularRelationsKey,
} from '~/common';
import { PropAction } from '../actions';
import { Condition } from '../conditions';
import { PermGranter } from './perm-granter';

export abstract class PropGranter<
  TResourceStatic extends ResourceShape<any>
> extends PermGranter<TResourceStatic, PropAction> {
  constructor(
    protected resource: EnhancedResource<TResourceStatic>,
    protected properties: Array<keyof TResourceStatic['prototype'] & string>,
    stagedCondition?: Condition<TResourceStatic>
  ) {
    super(stagedCondition);
  }

  /**
   * The requester can read this.
   */
  get read() {
    return this.action('read');
  }

  /**
   * The requester can read & modify this.
   */
  get edit() {
    return this.action('read', 'edit');
  }
}

export class PropGranterImpl<
  TResourceStatic extends ResourceShape<any>
> extends PropGranter<TResourceStatic> {
  extract() {
    return {
      resource: this.resource,
      properties: this.properties,
      perms: this.perms,
    };
  }

  static forResource<TResourceStatic extends ResourceShape<any>>(
    resource: EnhancedResource<TResourceStatic>,
    stagedCondition: Condition<TResourceStatic> | undefined
  ): PropsGranter<TResourceStatic> {
    const propsGranter = mapFromList(
      resource.securedPropsAndSingularRelationKeys,
      (prop) => [prop, new PropGranterImpl(resource, [prop], stagedCondition)]
    ) as PropsGranter<TResourceStatic>;
    propsGranter.many = (...props) => new PropGranterImpl(resource, props);

    return propsGranter;
  }
}

export type PropsGranter<TResourceStatic extends ResourceShape<any>> = Record<
  SecuredPropsAndSingularRelationsKey<TResourceStatic>,
  PropGranter<TResourceStatic>
> & {
  /**
   * A shortcut to apply actions to many properties at once.
   */
  many: (
    ...props: Array<SecuredPropsAndSingularRelationsKey<TResourceStatic>>
  ) => PropGranter<TResourceStatic>;
};
