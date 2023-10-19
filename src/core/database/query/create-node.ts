import { entries } from '@seedcompany/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  // eslint-disable-next-line @seedcompany/no-unused-vars -- used in jsdoc
  DbLabel,
  EnhancedResource,
  generateId,
  ID,
  ResourceShape,
  UnsecuredDto,
} from '../../../common';
import { FileId } from '../../../components/file';
import { Variable } from '../query-augmentation/condition-variables';

export interface CreateNodeOptions<TResourceStatic extends ResourceShape<any>> {
  initialProps?: InitialPropsOf<UnsecuredDto<TResourceStatic['prototype']>>;
  baseNodeProps?: Record<string, any>;
}

type InitialPropsOf<T> = {
  [K in keyof T]?: Variable | (T[K] extends FileId ? ID : T[K]);
};

/**
 * This aids in composing create statements for a new base node and its initial properties.
 *
 * id & createdAt properties are generated and applied automatically.
 * BaseNode labels are pulled from the resource's class hierarchy or manually
 * defined with {@link DbLabel @DbLabel()}
 *
 * Any unique labels for properties are pulled from {@link DbLabel @DbLabel()}
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
