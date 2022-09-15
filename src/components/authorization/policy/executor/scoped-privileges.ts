import { LazyGetter as Once } from 'lazy-get-decorator';
import { compact, last, lowerCase, startCase } from 'lodash';
import {
  ChildListsKey,
  ChildSinglesKey,
  EnhancedResource,
  isSecured,
  keys,
  mapFromList,
  ResourceShape,
  SecuredResource,
  SecuredResourceKey,
  Session,
  UnauthorizedException,
} from '~/common';
import { ChangesOf, isRelation } from '~/core/database/changes';
import { DbPropsOfDto } from '~/core/database/results';
import {
  AnyAction,
  ChildListAction,
  ChildSingleAction,
  PropAction,
  ResourceAction,
} from '../actions';
import {
  AllPermissionsView,
  createAllPermissionsView,
} from './all-permissions-view';
import { PolicyExecutor } from './policy-executor';

export class ScopedPrivileges<TResourceStatic extends ResourceShape<any>> {
  private readonly resource: EnhancedResource<TResourceStatic>;
  constructor(
    resource: TResourceStatic,
    private readonly object: TResourceStatic['prototype'] | undefined,
    private readonly session: Session,
    private readonly policyExecutor: PolicyExecutor
  ) {
    this.resource = EnhancedResource.of(resource);
  }

  can(action: ResourceAction): boolean;
  can(action: PropAction, prop: SecuredResourceKey<TResourceStatic>): boolean;
  can(
    action: ChildSingleAction,
    relation: ChildSinglesKey<TResourceStatic>
  ): boolean;
  can(
    action: ChildListAction,
    relation: ChildListsKey<TResourceStatic>
  ): boolean;
  can(action: AnyAction, prop?: SecuredResourceKey<TResourceStatic>) {
    return this.policyExecutor.execute(
      action,
      this.session,
      this.resource,
      this.object,
      prop
    );
  }

  verifyCan(action: ResourceAction): void;
  verifyCan(
    action: PropAction,
    prop: SecuredResourceKey<TResourceStatic>
  ): void;
  verifyCan(
    action: ChildSingleAction,
    relation: ChildSinglesKey<TResourceStatic>
  ): void;
  verifyCan(
    action: ChildListAction,
    relation: ChildListsKey<TResourceStatic>
  ): void;
  verifyCan(action: AnyAction, prop?: string) {
    // @ts-expect-error yeah IDK why but this is literally the signature.
    if (this.can(action, prop)) {
      return;
    }
    throw new UnauthorizedException(
      `You do not have the permission to ${action} ${
        this.object ? 'this' : 'any'
      } ${lowerCase(this.resource.name)}${prop ? '.' + prop : ''}`
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
    { pathPrefix: pathPrefixProp }: { pathPrefix?: string | null } = {}
  ) {
    if (!this.object) {
      throw new Error('Current object is required to verify changes');
    }

    const pathPrefix =
      pathPrefixProp ?? pathPrefixProp === null
        ? null
        : // Guess the input field path based on name convention
          last(startCase(this.resource.name).split(' '))!.toLowerCase();

    for (const prop of keys(changes)) {
      const dtoPropName = isRelation(prop, this.object)
        ? prop.slice(0, -2)
        : prop;
      const dtoProp = this.object[dtoPropName];
      if (!isSecured(dtoProp) || dtoProp.canEdit) {
        continue;
      }
      const fullPath = compact([pathPrefix, prop]).join('.');
      throw new UnauthorizedException(
        `You do not have permission to update ${this.resource.name}.${prop}`,
        fullPath
      );
    }
  }

  /**
   * Takes the given dto which has unsecured props and returns the props that
   * are supposed to be secured (unsecured props are omitted) as secured.
   *
   * This is mainly here to service the existing codebase. I suspect we'll want
   * to migrate to a different method that handles things in a slightly different way.
   */
  secureProps(
    dto: DbPropsOfDto<TResourceStatic['prototype']>
  ): SecuredResource<TResourceStatic, false> {
    const securedProps = mapFromList(this.resource.securedProps, (key) => {
      const canRead = this.can('read', key);
      const canEdit = this.can('edit', key);
      let value = (dto as any)[key];
      value = canRead ? value : Array.isArray(value) ? [] : undefined;
      return [key, { value, canRead, canEdit }];
    });
    return securedProps as SecuredResource<TResourceStatic, false>;
  }
}
