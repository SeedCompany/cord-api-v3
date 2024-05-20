import { entries } from '@seedcompany/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  EnhancedResource,
  generateId,
  ID,
  Resource,
  ResourceShape,
  UnsecuredDto,
} from '~/common';
import { LinkTo } from '~/core';
import { FileId } from '../../../components/file/dto';
import { Variable } from '../query-augmentation/condition-variables';

export interface CreateNodeOptions<TResourceStatic extends ResourceShape<any>> {
  initialProps?: InitialPropsOf<
    UnsecuredDto<InstanceType<TResourceStatic>> &
      Partial<Pick<Resource, 'id' | 'createdAt'>>
  >;
  baseNodeProps?: Record<string, any>;
}

type InitialPropsOf<T> = {
  [K in keyof T & string]?:
    | Variable
    | (T[K] & {} extends FileId | LinkTo<'File'> ? ID : T[K]);
};

/**
 * This aids in composing create statements for a new base node and its initial properties.
 *
 * id & createdAt properties are generated and applied automatically.
 * BaseNode labels are pulled from the resource's class hierarchy or manually
 * defined with {@link import('~/common').DbLabel @DbLabel()}
 *
 * Any unique labels for properties are pulled from {@link import('~/common').DbLabel @DbLabel()}
 * decoration on the resource's properties.
 *
 * Note that we need to define all properties at create even if they are null/undefined.
 * This allows matches to work easier. This does not handle missing keys from user
 * input, so it's encouraged to manually define initialValues key/value pairs passed in here.
 *
 * @example
 * query()
 * .apply(await createNode(User, {
 *   initialProps: {
 *     email: input.email,
 *     ...
 *   },
 * })
 */
export const createNode = async <TResourceStatic extends ResourceShape<any>>(
  resource: TResourceStatic | EnhancedResource<TResourceStatic>,
  { initialProps = {}, baseNodeProps = {} }: CreateNodeOptions<TResourceStatic>,
) => {
  const res = EnhancedResource.of(resource);
  const {
    id = baseNodeProps.id ?? (await generateId()),
    createdAt = baseNodeProps.createdAt ?? DateTime.local(),
    ...restInitialProps
  } = initialProps;

  const imports = Object.values({ ...initialProps, ...baseNodeProps }).filter(
    (val) => val instanceof Variable,
  );

  return (query: Query) =>
    query.comment`createNode(${resource.name})`.subQuery(imports, (sub) =>
      sub
        .create([
          [
            node('node', res.dbLabels, {
              ...baseNodeProps,
              createdAt,
              id,
            }),
          ],
          ...entries(restInitialProps).map(([prop, value]) => [
            node('node'),
            relation('out', '', prop, { active: true, createdAt }),
            node('', res.dbPropLabels[prop] ?? ['Property'], {
              createdAt,
              value,
            }),
          ]),
        ])
        .return('node'),
    );
};
