import { entries, setHas, setOf } from '@seedcompany/common';
import { omit } from 'lodash';
import type { AbstractClass, Class, LiteralUnion } from 'type-fest';
import type { LinkTo, LinkToUnknown, ResourceMap } from '~/core/resources';
import { type ID } from './id-field';
import { OmitType } from './types';

export const AsChangesType = <
  T,
  Args extends unknown[],
  const OmitKeys extends keyof T,
  const Links extends LiteralUnion<keyof T & string, string>,
>(
  classRef: AbstractClass<T, Args>,
  options: {
    omit: readonly OmitKeys[];
    links: readonly Links[];
  },
) => {
  const links = setOf(options.links);
  type Output = IDsAsLinks<Omit<T, OmitKeys>, Links>;
  return Object.assign(
    OmitType(classRef, [
      ...options.omit,
      ...(options.links as ReadonlyArray<keyof T>),
    ]) as Class<Output, Args>,
    {
      Links: links,
      fromUpdateChanges: makeForUpdate<Omit<T, OmitKeys>, Output>(links),
    },
  );
};

// eslint-disable-next-line @seedcompany/no-unused-vars
type LinksAsIDs<T, Links extends LiteralUnion<keyof T & string, string>> = {
  [K in Links]?: K extends keyof T
    ? T[K] extends LinkTo<infer IDType>
      ? ID<IDType> | (T[K] extends null ? null : never)
      : T[K]
    : never;
};

type IDsAsLinks<T, Links extends LiteralUnion<keyof T & string, string>> = Omit<
  T,
  Links
> & {
  [K in Links]?: K extends keyof T
    ? T[K] & {} extends ID<infer IDType extends keyof ResourceMap>
      ?
          | (keyof ResourceMap extends IDType ? LinkToUnknown : LinkTo<IDType>)
          | (null extends T[K] ? null : never)
      : T[K]
    : never;
};

const makeForUpdate =
  <Input extends object, Output>(links: ReadonlySet<string>) =>
  (changes: Input): Output => {
    return Object.fromEntries(
      entries(omit(changes, ['modifiedAt'])).map(([key, value]) => [
        key,
        value && setHas(links, key) ? { id: value } : value,
      ]),
    ) as Output;
  };
