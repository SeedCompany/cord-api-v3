import { ChildRelationsKey, mapFromList, ResourceShape } from '~/common';
import { ChildRelationshipAction } from '../actions';
import { Condition } from '../conditions';
import { PermGranter } from './perm-granter';

export abstract class ChildRelationshipGranter<
  TResourceStatic extends ResourceShape<any>
> extends PermGranter<TResourceStatic, ChildRelationshipAction> {
  constructor(
    protected resource: TResourceStatic,
    protected relationNames: Array<ChildRelationsKey<TResourceStatic>>,
    stagedCondition?: Condition<TResourceStatic>
  ) {
    super(stagedCondition);
  }

  /**
   * The requester can read this relationship.
   */
  get read() {
    return this.action('read');
  }

  /**
   * A shortcut for read, create, delete.
   */
  get edit() {
    return this.action('read', 'create', 'delete');
  }

  /**
   * The requester can create an instance of this resource & associate it on this edge.
   */
  get create() {
    return this.action('create');
  }

  /**
   * The requester can delete an instance of this resource that is associated on this edge.
   */
  get delete() {
    return this.action('delete');
  }
}

export class ChildRelationshipGranterImpl<
  TResourceStatic extends ResourceShape<any>
> extends ChildRelationshipGranter<TResourceStatic> {
  extract() {
    return {
      resource: this.resource,
      relationNames: this.relationNames,
      perms: this.perms,
    };
  }

  static forResource<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic,
    stagedCondition: Condition<TResourceStatic> | undefined
  ): ChildRelationshipsGranter<TResourceStatic> {
    const keys = Object.keys(resource.Relations ?? {}) as Array<
      ChildRelationsKey<TResourceStatic>
    >;
    const granter = mapFromList(keys, (prop) => [
      prop,
      new ChildRelationshipGranterImpl(resource, [prop], stagedCondition),
    ]) as ChildRelationshipsGranter<TResourceStatic>;
    granter.many = (...relations) =>
      new ChildRelationshipGranterImpl(resource, relations);

    return granter;
  }
}

export type ChildRelationshipsGranter<
  TResourceStatic extends ResourceShape<any>
> = Record<
  ChildRelationsKey<TResourceStatic>,
  ChildRelationshipGranter<TResourceStatic>
> & {
  /**
   * A shortcut to apply actions to many relations at once.
   */
  many: (
    ...relations: Array<ChildRelationsKey<TResourceStatic>>
  ) => ChildRelationshipGranter<TResourceStatic>;
};
