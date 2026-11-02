import type { AbstractClass } from 'type-fest';

type Thunk<T> = T | (() => T);

export type ResourceShape<T> = AbstractClass<T> & {
  Props?: string[];
  SecuredProps?: string[];
  Relations?: Thunk<
    Record<
      string,
      ResourceShape<any> | readonly [ResourceShape<any>] | undefined
    >
  >;
  /**
   * Define this resource as being a child of another.
   * This means it's _created_ and scoped under this other resource.
   * This _type_ cannot exist without this parent.
   */
  Parent?: (() => Promise<any>) | 'dynamic';
};

export type ResourceRelationsShape = ResourceShape<any>['Relations'];
