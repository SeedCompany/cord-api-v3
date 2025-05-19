import { LazyGetter as Once } from 'lazy-get-decorator';
import {
  EnhancedResource,
  type ResourceShape,
  UnauthorizedException,
} from '~/common';
import { type ResourceObjectContext } from '../object.type';
import {
  type AllPermissionsOfEdgeView,
  createAllPermissionsOfEdgeView,
} from './all-permissions-view';
import {
  type FilterOptions,
  type PolicyExecutor,
  type ResolveParams,
} from './policy-executor';

export class EdgePrivileges<
  TResourceStatic extends ResourceShape<any>,
  TKey extends string,
  TAction extends string,
> {
  readonly resource: EnhancedResource<TResourceStatic>;
  constructor(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    readonly key: TKey,
    private readonly object: ResourceObjectContext<TResourceStatic> | undefined,
    private readonly policyExecutor: PolicyExecutor,
  ) {
    this.resource = EnhancedResource.of(resource);
  }

  get context() {
    return this.object;
  }

  forContext(object: ResourceObjectContext<TResourceStatic>) {
    if (object === this.object) {
      return this;
    }
    return new EdgePrivileges(
      this.resource,
      this.key,
      object,
      this.policyExecutor,
    );
  }

  can(action: TAction) {
    const perm = this.policyExecutor.resolve({
      action,
      resource: this.resource,
      prop: this.key,
    });
    return perm === true || perm === false
      ? perm
      : perm.isAllowed({
          object: this.object,
          resource: this.resource,
          session: this.policyExecutor.sessionHost.current,
        });
  }

  verifyCan(action: TAction) {
    if (this.can(action)) {
      return;
    }
    throw UnauthorizedException.fromPrivileges(
      action,
      this.object,
      this.resource,
      this.key,
    );
  }

  /**
   * An alternative view that gives an object with all the permissions for
   * actions.
   * @example
   * const privileges = Privileges.forEdge(User, 'email');
   * if (privileges.all.read) {
   *   // can read
   * }
   */
  @Once()
  get all(): AllPermissionsOfEdgeView<TAction> {
    return createAllPermissionsOfEdgeView(this.resource, this);
  }

  /**
   * Applies a filter to the `node` so that only readable nodes continue based on our polices.
   * This requires `node` & `project` to be defined where this cypher snippet
   * is inserted.
   */
  filterToReadable(options?: FilterOptions) {
    return this.dbFilter({
      action: 'read',
      ...options,
    });
  }

  dbFilter(options: FilterOptions & Pick<ResolveParams, 'action'>) {
    return this.policyExecutor.cypherFilter({
      ...options,
      resource: this.resource,
      prop: this.key,
    });
  }
}

/**
 * @deprecated Use {@link EdgePrivileges} instead.
 */
export type UserEdgePrivileges<
  TResourceStatic extends ResourceShape<any>,
  TKey extends string,
  TAction extends string,
> = EdgePrivileges<TResourceStatic, TKey, TAction>;
