import { mapFromList, ResourceShape, SecuredResourceKey } from '~/common';
import { PermGranter } from './perm-granter';

export abstract class PropGranter<
  TResourceStatic extends ResourceShape<any>
> extends PermGranter<TResourceStatic> {
  constructor(
    protected resource: TResourceStatic,
    protected properties: Array<keyof TResourceStatic['prototype'] & string>
  ) {
    super();
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

  protected newThis(): this {
    return new PropGranterImpl(this.resource, this.properties) as this;
  }

  static forResource<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic
  ): PropsGranter<TResourceStatic> {
    const propsGranter = mapFromList(
      [
        ...resource.SecuredProps,
        ...Object.keys(resource.Relations ?? {}),
      ] as Array<SecuredResourceKey<TResourceStatic>>,
      (prop) => [prop, new PropGranterImpl(resource, [prop])]
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
