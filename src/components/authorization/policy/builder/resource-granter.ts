import { many, Many, ResourceShape } from '~/common';
import type { ResourceMap } from '../../model/resource-map';
import { PermGranter } from './perm-granter';
import { PropGranter, PropGranterImpl, PropsGranter } from './prop-granter';

export abstract class ResourceGranter<
  TResourceStatic extends ResourceShape<any>
> extends PermGranter<TResourceStatic> {
  protected propGrants: ReadonlyArray<PropGranterImpl<TResourceStatic>> = [];

  constructor(protected resource: TResourceStatic) {
    super();
  }

  /**
   * The requester can read the object (via lists or individual lookups)
   * and can read all props not specifically defined.
   */
  get read() {
    return super.read;
  }

  /**
   * The requester can edit all props not specifically defined.
   * {@link read} is implied.
   */
  get edit() {
    return super.edit;
  }

  /**
   * The requester can create a new instance of this resource.
   */
  get create() {
    return this.action('create');
  }
  /**
   * The requester can delete this object.
   */
  get delete() {
    return this.action('delete');
  }

  /**
   * Grant specific actions to individual props of this object.
   *
   * Any props not explicitly defined will fall back to granted actions defined
   * on this object.
   *
   * Conditions previously given will apply automatically to these props,
   * unless the prop defines its own condition.
   */
  specifically(
    grants: (
      granter: PropsGranter<TResourceStatic>
    ) => Many<PropGranter<TResourceStatic>>
  ) {
    const propsGranter = PropGranterImpl.forResource(
      this.resource,
      this.stagedCondition
    );

    const newGrants = grants(propsGranter) as Many<
      PropGranterImpl<TResourceStatic>
    >;

    const cloned = this.clone();
    cloned.propGrants = [...this.propGrants, ...many(newGrants)];
    return cloned;
  }
}

export class ResourceGranterImpl<
  TResourceStatic extends ResourceShape<any>
> extends ResourceGranter<TResourceStatic> {
  extract() {
    return {
      resource: this.resource,
      perms: this.perms,
      props: this.propGrants.map((prop) => prop.extract()),
    };
  }

  protected clone(): this {
    const cloned = super.clone();
    cloned.propGrants = [...this.propGrants];
    return cloned;
  }
}

export type ResourcesGranter = {
  [K in keyof ResourceMap]: ResourceGranter<ResourceMap[K]>;
};
