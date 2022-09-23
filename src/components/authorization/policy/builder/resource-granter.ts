import { mapValues } from 'lodash';
import { EnhancedResource, many, Many, ResourceShape } from '~/common';
import type { EnhancedResourceMap } from '~/core';
import type { ResourceMap } from '../../model/resource-map';
import { ResourceAction } from '../actions';
import {
  ChildRelationshipGranter,
  ChildRelationshipsGranter,
} from './child-relationship-granter';
import { PermGranter } from './perm-granter';
import { PropGranter, PropGranterImpl, PropsGranter } from './prop-granter';

export abstract class ResourceGranter<
  TResourceStatic extends ResourceShape<any>
> extends PermGranter<TResourceStatic, ResourceAction> {
  protected propGrants: ReadonlyArray<PropGranterImpl<TResourceStatic>> = [];
  protected childRelationshipGrants: ReadonlyArray<
    ChildRelationshipGranter<TResourceStatic>
  > = [];

  constructor(protected resource: EnhancedResource<TResourceStatic>) {
    super();
  }

  /**
   * The requester can read the object (via lists or individual lookups)
   * and can read all props not specifically defined.
   */
  get read() {
    return this.action('read');
  }

  /**
   * The requester can edit all props not specifically defined.
   * {@link read} is implied.
   */
  get edit() {
    return this.action('read', 'edit');
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

  /**
   * Grant actions to specific child relations of this resource.
   *
   * PREFER defining these actions directly on the resource itself if possible.
   * For example, `Engagements.read` over `Project.children(c => c.engagements.read)`.
   * This is used when a resource has dynamic parents/edges, like Locations or Comments,
   * and specific actions for this specified relation edge need to be defined.
   *
   * Relations without specific edges will fall back to what's defined at the resource level.
   * i.e. `Engagements.create` -> `Project.engagements.create`.
   *
   * Conversely, when checking for these permissions, use the specific relation
   * edge when possible as this gives the most info.
   *
   * Conditions previously given will apply automatically to these relations,
   * unless the relation defines its own condition.
   */
  children(
    relationGrants: (
      granter: ChildRelationshipsGranter<TResourceStatic>
    ) => Many<ChildRelationshipGranter<TResourceStatic>>
  ) {
    const granter = ChildRelationshipGranter.forResource(
      this.resource,
      this.stagedCondition
    );

    const newGrants = relationGrants(granter);

    const cloned = this.clone();
    cloned.childRelationshipGrants = [
      ...this.childRelationshipGrants,
      ...many(newGrants),
    ];
    return cloned;
  }
}

export class ResourceGranterImpl<
  TResourceStatic extends ResourceShape<any>
> extends ResourceGranter<TResourceStatic> {
  static create(map: EnhancedResourceMap): ResourcesGranter {
    return mapValues(
      map,
      (resource: EnhancedResource<any>) => new ResourceGranterImpl(resource)
    ) as any;
  }

  extract() {
    return {
      resource: this.resource,
      perms: this.perms,
      props: this.propGrants.map((prop) => prop.extract()),
      childRelationships: this.childRelationshipGrants.map((rel) =>
        rel.extract()
      ),
    };
  }

  protected clone(): this {
    const cloned = super.clone();
    cloned.propGrants = [...this.propGrants];
    cloned.childRelationshipGrants = [...this.childRelationshipGrants];
    return cloned;
  }
}

export type ResourcesGranter = {
  [K in keyof ResourceMap]: ResourceGranter<ResourceMap[K]>;
};
