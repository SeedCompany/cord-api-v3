import { LazyGetter as Once } from 'lazy-get-decorator';
import { lowerCase } from 'lodash';
import {
  EnhancedResource,
  ResourceShape,
  Session,
  UnauthorizedException,
} from '~/common';
import {
  AllPermissionsOfEdgeView,
  createAllPermissionsOfEdgeView,
} from './all-permissions-view';
import {
  FilterOptions,
  PolicyExecutor,
  ResolveParams,
} from './policy-executor';

export class UserEdgePrivileges<
  TResourceStatic extends ResourceShape<any>,
  TKey extends string,
  TAction extends string
> {
  private readonly resource: EnhancedResource<TResourceStatic>;
  constructor(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    private readonly key: TKey,
    private readonly object: TResourceStatic['prototype'] | undefined,
    private readonly session: Session,
    private readonly policyExecutor: PolicyExecutor
  ) {
    this.resource = EnhancedResource.of(resource);
  }

  can(action: TAction) {
    const perm = this.policyExecutor.resolve({
      action,
      session: this.session,
      resource: this.resource,
      prop: this.key,
    });
    return perm === true || perm === false
      ? perm
      : perm.isAllowed({ object: this.object, resource: this.resource });
  }

  verifyCan(action: TAction) {
    if (this.can(action)) {
      return;
    }
    throw new UnauthorizedException(
      `You do not have the permission to ${action} ${
        this.object ? 'this' : 'any'
      } ${lowerCase(this.resource.name)}.${this.key}`
    );
  }

  /**
   * An alternative view that gives an object with all the permissions for
   * actions.
   * @example
   * const privileges = Privileges.forEdge(User, 'email').forUser(session);
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
      session: this.session,
      resource: this.resource,
      prop: this.key,
    });
  }
}
