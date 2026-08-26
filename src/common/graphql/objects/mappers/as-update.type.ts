import { entries, setHas, setOf } from '@seedcompany/common';
import { omit, pick } from 'lodash';
import type { AbstractClass, Class, LiteralUnion } from 'type-fest';
import { type ID } from '~/common/types';
import type { LinkTo, LinkToUnknown, ResourceMap } from '~/core/resources';
import { OmitType } from './type-mappers';

/**
 * Converts a GQL `input` UpdateX class to a GQL `type` (output) XUpdate class.
 */
export const AsUpdateType = <
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
      fromInput: makeFromInput<Omit<T, OmitKeys>, Output>(links),
      pickPrevious: (
        prev: AsStored<Output>,
        changes: Omit<T, OmitKeys>,
      ): Output =>
        omit(pick(prev, Object.keys(changes)), 'modifiedAt') as Output,
    },
  );
};

/**
 * What `pickPrevious` reads from: the record as it is actually stored, rather
 * than the update input's shape.
 *
 * The two differ on nullability, and the difference is real. An input field is
 * optional (`planned?: boolean`) because a client may leave it out; a stored
 * field can be genuinely blank (`planned: boolean | null`) because nobody ever
 * set it — which several columns became in migration 0042, so that a Neo4j
 * blank survives the cutover instead of arriving as a definite `false`. Only
 * inputs that let a client *clear* a value carry `| null` themselves, and
 * widening those to match here would say clients can blank any of these.
 *
 * The return stays `Output`: the previous value goes onto a subscription
 * payload whose fields are all nullable already.
 */
type AsStored<T> = { [K in keyof T]: T[K] | null };

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

const makeFromInput =
  <Input extends object, Output>(links: ReadonlySet<string>) =>
  (changes: Input): Output => {
    return Object.fromEntries(
      entries(omit(changes, ['modifiedAt'])).map(([key, value]) => [
        key,
        value && setHas(links, key) ? { id: value } : value,
      ]),
    ) as Output;
  };
