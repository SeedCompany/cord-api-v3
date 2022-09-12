import { mapFromList, ResourceShape, SecuredResourceKey } from '~/common';
import { Condition } from '../conditions';
import { PermGranter } from './perm-granter';

export abstract class PropGranter<
  TResourceStatic extends ResourceShape<any>
> extends PermGranter<TResourceStatic> {
  constructor(
    protected resource: TResourceStatic,
    protected properties: Array<keyof TResourceStatic['prototype'] & string>,
    stagedCondition?: Condition<TResourceStatic>
  ) {
    super(stagedCondition);
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
    resource: TResourceStatic,
    stagedCondition: Condition<TResourceStatic> | undefined
  ): PropsGranter<TResourceStatic> {
    const propsGranter = mapFromList(
      [
        ...resource.SecuredProps,
        ...Object.keys(resource.Relations ?? {}),
      ] as Array<SecuredResourceKey<TResourceStatic>>,
      (prop) => [prop, new PropGranterImpl(resource, [prop], stagedCondition)]
    ) as PropsGranter<TResourceStatic>;
    propsGranter.many = (...props) => new PropGranterImpl(resource, props);

    return propsGranter;
  }
}

export type PropsGranter<TResourceStatic extends ResourceShape<any>> = Record<
  SecuredResourceKey<TResourceStatic>,
  PropGranter<TResourceStatic>
> & {
  /**
   * A shortcut to apply actions to many properties at once.
   */
  many: (
    ...props: Array<SecuredResourceKey<TResourceStatic>>
  ) => PropGranter<TResourceStatic>;
};
