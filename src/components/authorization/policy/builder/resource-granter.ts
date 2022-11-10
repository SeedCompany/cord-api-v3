import {
  EnhancedResource,
  many,
  Many,
  ResourceShape,
  SecuredPropsPlusExtraKey,
} from '~/common';
import { ResourceAction } from '../actions';
import {
  ChildRelationshipGranter,
  ChildRelationshipsGranter,
} from './child-relationship-granter';
import { action, extract, PermGranter, withPerms } from './perm-granter';
import { PropGranter, PropsGranter } from './prop-granter';

export const withOther = Symbol('ResourceGranter.withOther');

export const andAllProps = Symbol('ResourceGranter.andAllProps');

export type PropsGranterFn<TResourceStatic extends ResourceShape<any>> = (
  granter: PropsGranter<TResourceStatic>
) => Many<PropGranter<TResourceStatic>>;

export type ChildrenGranterFn<TResourceStatic extends ResourceShape<any>> = (
  granter: ChildRelationshipsGranter<TResourceStatic>
) => Many<ChildRelationshipGranter<TResourceStatic>>;

export class ResourceGranter<
  TResourceStatic extends ResourceShape<any>
> extends PermGranter<TResourceStatic, ResourceAction> {
  protected propGrants: ReadonlyArray<PropGranter<TResourceStatic>> = [];
  protected childRelationshipGrants: ReadonlyArray<
    ChildRelationshipGranter<TResourceStatic>
  > = [];

  constructor(protected resource: EnhancedResource<TResourceStatic>) {
    super();
  }

  /**
   * Grant specific actions to individual props of this object.
   *
   * Any props not explicitly defined (from any policy) will fall back to granted
   * actions defined on this object (from any policy).
   *
   * Conditions previously given will apply automatically to these props,
   * unless the prop defines its own condition.
   */
  protected specifically(grants: PropsGranterFn<TResourceStatic>): this {
    const propsGranter = PropGranter.forResource(
      this.resource,
      this.stagedCondition
    );

    const newGrants = many(grants(propsGranter));

    const cloned = this.clone();
    cloned.trailingCondition =
      newGrants.length > 0 ? undefined : cloned.trailingCondition;
    cloned.propGrants = [...this.propGrants, ...newGrants];
    return cloned;
  }

  get [andAllProps](): this {
    return this.specifically((props) => {
      const all = Object.keys(props) as Array<
        SecuredPropsPlusExtraKey<TResourceStatic>
      >;
      const granter = props.many(...all);
      // TODO this should be filtered down to only actions applicable to props
      // For now it's ok for them to have extra as they'll just be unused.
      return granter[withPerms](...this.perms);
    });
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
  protected children(relationGrants: ChildrenGranterFn<TResourceStatic>): this {
    const granter = ChildRelationshipGranter.forResource(
      this.resource,
      this.stagedCondition
    );

    const newGrants = many(relationGrants(granter));

    const cloned = this.clone();
    cloned.trailingCondition =
      newGrants.length > 0 ? undefined : cloned.trailingCondition;
    cloned.childRelationshipGrants = [
      ...this.childRelationshipGrants,
      ...newGrants,
    ];
    return cloned;
  }

  [withOther](other: ResourceGranter<TResourceStatic>): this {
    const cloned = this.clone();
    cloned.perms = [...this.perms, ...other.perms];
    cloned.propGrants = [...this.propGrants, ...other.propGrants];
    cloned.childRelationshipGrants = [
      ...this.childRelationshipGrants,
      ...other.childRelationshipGrants,
    ];
    return cloned;
  }

  [extract]() {
    return {
      ...super[extract](),
      resource: this.resource,
      props: this.propGrants.map((prop) => prop[extract]()),
      childRelationships: this.childRelationshipGrants.map((rel) =>
        rel[extract]()
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

export class DefaultResourceGranter<
  TResourceStatic extends ResourceShape<any>
> extends ResourceGranter<TResourceStatic> {
  /**
   * The requester can read the object (via lists or individual lookups)
   * and can read all props not specifically defined.
   */
  get read() {
    return this[action]('read');
  }

  /**
   * The requester can edit all props not specifically defined.
   * {@link read} is implied.
   */
  get edit() {
    return this[action]('read', 'edit');
  }

  /**
   * The requester can create a new instance of this resource.
   */
  get create() {
    return this[action]('create');
  }

  /**
   * The requester can delete this object.
   */
  get delete() {
    return this[action]('delete');
  }

  specifically(grants: PropsGranterFn<TResourceStatic>): this {
    return super.specifically(grants);
  }

  /**
   * Use all preceding resource level actions for all the properties of this resource as well.
   *
   * This ensures that all props will have (at least) the resource level permissions
   * declared here, even if another policy declares something less permissive for a specific property.
   *
   * @example
   * // Policy A
   * r.Organization.read
   * // Policy B
   * r.Organization.specifically(p => p.address.none)
   * // Policy C
   * r.Organization.read.andAllProps
   * // If policy A & B apply, then the user has NO permission for address.
   * // If policy C applies, then the user has read permission for address,
   * // regardless of whether policy A or B are included.
   */
  get andAllProps(): this {
    return super[andAllProps];
  }

  children(grants: ChildrenGranterFn<TResourceStatic>): this {
    return super.children(grants);
  }
}
