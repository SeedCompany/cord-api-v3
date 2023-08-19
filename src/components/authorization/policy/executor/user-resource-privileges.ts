import { LazyGetter as Once } from 'lazy-get-decorator';
import { compact, last, startCase } from 'lodash';
import {
  ChildListsKey,
  ChildSinglesKey,
  EnhancedResource,
  mapFromList,
  ResourceShape,
  SecuredPropsPlusExtraKey,
  SecuredResource,
  SecuredResourceKey,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '~/common';
import { ChangesOf, isRelation } from '~/core/database/changes';
import {
  AnyAction,
  ChildListAction,
  ChildSingleAction,
  PropAction,
  ResourceAction,
} from '../actions';
import { ResourceObjectContext } from '../object.type';
import {
  AllPermissionsView,
  createAllPermissionsView,
} from './all-permissions-view';
import {
  FilterOptions,
  PolicyExecutor,
  ResolveParams,
} from './policy-executor';
import { UserEdgePrivileges } from './user-edge-privileges';

export class UserResourcePrivileges<
  TResourceStatic extends ResourceShape<any>,
> {
  readonly resource: EnhancedResource<TResourceStatic>;
  constructor(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    private readonly object: ResourceObjectContext<TResourceStatic> | undefined,
    readonly session: Session,
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
    return new UserResourcePrivileges(
      this.resource,
      object,
      this.session,
      this.policyExecutor,
    );
  }

  forEdge(
    key: SecuredPropsPlusExtraKey<TResourceStatic>,
    object?: ResourceObjectContext<TResourceStatic>,
  ): UserEdgePrivileges<
    TResourceStatic,
    SecuredPropsPlusExtraKey<TResourceStatic>,
    PropAction
  >;
  forEdge(
    key: ChildSinglesKey<TResourceStatic>,
    object?: ResourceObjectContext<TResourceStatic>,
  ): UserEdgePrivileges<
    TResourceStatic,
    ChildSinglesKey<TResourceStatic>,
    ChildSingleAction
  >;
  forEdge(
    key: ChildListsKey<TResourceStatic>,
    object?: ResourceObjectContext<TResourceStatic>,
  ): UserEdgePrivileges<
    TResourceStatic,
    ChildListsKey<TResourceStatic>,
    ChildListAction
  >;
  forEdge(key: string, object: any) {
    return new UserEdgePrivileges(
      this.resource,
      key,
      object ?? this.object,
      this.session,
      this.policyExecutor,
    );
  }

  can(action: ResourceAction): boolean;
  can(
    action: PropAction,
    prop: SecuredPropsPlusExtraKey<TResourceStatic>,
  ): boolean;
  can(
    action: ChildSingleAction,
    relation: ChildSinglesKey<TResourceStatic>,
  ): boolean;
  can(
    action: ChildListAction,
    relation: ChildListsKey<TResourceStatic>,
  ): boolean;
  can(action: AnyAction, prop?: SecuredResourceKey<TResourceStatic>) {
    const perm = this.policyExecutor.resolve({
      action,
      session: this.session,
      resource: this.resource,
      prop,
    });
    return perm === true || perm === false
      ? perm
      : perm.isAllowed({
          object: this.object,
          resource: this.resource,
          session: this.session,
        });
  }

  verifyCan(action: ResourceAction): void;
  verifyCan(
    action: PropAction,
    prop: SecuredPropsPlusExtraKey<TResourceStatic>,
  ): void;
  verifyCan(
    action: ChildSingleAction,
    relation: ChildSinglesKey<TResourceStatic>,
  ): void;
  verifyCan(
    action: ChildListAction,
    relation: ChildListsKey<TResourceStatic>,
  ): void;
  verifyCan(action: AnyAction, prop?: string) {
    // @ts-expect-error yeah IDK why but this is literally the signature.
    if (this.can(action, prop)) {
      return;
    }
    throw UnauthorizedException.fromPrivileges(
      action,
      this.object,
      this.resource,
      prop,
    );
  }

  /**
   * An alternative view that gives an object with all the permissions for
   * each property & relation.
   * @example
   * const privileges = Privileges.for(session, User);
   * if (privileges.all.email.read) {
   *   // can read
   * }
   */
  @Once()
  get all(): AllPermissionsView<TResourceStatic> {
    return createAllPermissionsView(this.resource, this);
  }

  /**
   * Verifies the current user can make the changes specified to the given object.
   */
  verifyChanges(
    changes: ChangesOf<TResourceStatic['prototype']>,
    {
      pathPrefix: pathPrefixProp,
    }: {
      pathPrefix?: string | null;
    } = {},
  ) {
    const pathPrefix =
      pathPrefixProp ?? pathPrefixProp === null
        ? null
        : // Guess the input field path based on name convention
          last(startCase(this.resource.name).split(' '))!.toLowerCase();

    for (const prop of Object.keys(changes)) {
      const dtoPropName: any = isRelation(this.resource, prop)
        ? prop.slice(0, -2)
        : prop;
      if (!this.resource.securedProps.has(dtoPropName)) {
        continue;
      }
      if (this.can('edit', dtoPropName)) {
        continue;
      }
      const fullPath = compact([pathPrefix, prop]).join('.');
      throw new UnauthorizedException(
        `You do not have permission to update ${this.resource.name}.${prop}`,
        fullPath,
      );
    }
  }

  /**
   * Takes the given unsecured dto which has unsecured props and returns the props that
   * are supposed to be secured (unsecured props are omitted) as secured.
   */
  secure(
    dto: UnsecuredDto<TResourceStatic['prototype']>,
  ): TResourceStatic['prototype'] {
    // Be helpful and allow object param to be skipped upstream.
    // But it still can be used if given possible for use with condition wrapper functions.
    const perms = this.object ? this : this.forContext(dto);

    const securedProps = mapFromList(this.resource.securedProps, (key) => {
      const canRead = perms.can('read', key);
      const canEdit = perms.can('edit', key);
      let value = (dto as any)[key];
      value = canRead ? value : Array.isArray(value) ? [] : undefined;
      return [key, { value, canRead, canEdit }];
    }) as SecuredResource<TResourceStatic, false>;

    return {
      ...dto,
      ...securedProps,
      canDelete: perms.can('delete'),
    };
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
    });
  }
}
