import {
  ChildListsKey,
  ChildSinglesKey,
  EnhancedResource,
  ResourceShape,
} from '~/common';
import { ChildListAction, ChildSingleAction } from '../actions';
import { Condition } from '../conditions';
import { createLazyRecord } from '../lazy-record';
import { extract, PermGranter } from './perm-granter';

export abstract class ChildRelationshipGranter<
  TResourceStatic extends ResourceShape<any>,
  TRelName extends string = string,
  TAction extends string = string
> extends PermGranter<TResourceStatic, TAction> {
  constructor(
    protected resource: EnhancedResource<TResourceStatic>,
    protected relationNames: TRelName[],
    stagedCondition?: Condition<TResourceStatic>
  ) {
    super(stagedCondition);
  }

  [extract]() {
    return {
      ...super[extract](),
      resource: this.resource,
      relationNames: this.relationNames,
    };
  }

  static forResource<TResourceStatic extends ResourceShape<any>>(
    resource: EnhancedResource<TResourceStatic>,
    stagedCondition: Condition<TResourceStatic> | undefined
  ): ChildRelationshipsGranter<TResourceStatic> {
    const granter = createLazyRecord<
      ChildRelationshipsGranter<TResourceStatic>
    >({
      getKeys: () => resource.childKeys,
      calculate: (rel) => {
        const cls = resource.childSingleKeys.has(rel)
          ? ChildSingleGranter
          : ChildListGranter;
        return new cls(resource, [rel as any], stagedCondition) as any;
      },
    });
    return granter;
  }
}

export class ChildSingleGranter<
  TResourceStatic extends ResourceShape<any>
> extends ChildRelationshipGranter<
  TResourceStatic,
  ChildSinglesKey<TResourceStatic>,
  ChildSingleAction
> {
  /**
   * The requester can read this relationship.
   */
  get read() {
    return this.action('read');
  }

  /**
   * The requester can swap this relationship edge to another resource.
   */
  get edit() {
    return this.action('read', 'edit');
  }
}

export class ChildListGranter<
  TResourceStatic extends ResourceShape<any>
> extends ChildRelationshipGranter<
  TResourceStatic,
  ChildListsKey<TResourceStatic>,
  ChildListAction
> {
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

export type ChildRelationshipsGranter<
  TResourceStatic extends ResourceShape<any>
> = Record<
  ChildSinglesKey<TResourceStatic>,
  Omit<ChildSingleGranter<TResourceStatic>, 'extract'>
> &
  Record<
    ChildListsKey<TResourceStatic>,
    Omit<ChildListGranter<TResourceStatic>, 'extract'>
  >;
