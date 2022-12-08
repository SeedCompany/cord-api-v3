import { node, Query, relation } from 'cypher-query-builder';
import { compact } from 'lodash';
import { DateTime } from 'luxon';
import { MergeExclusive } from 'type-fest';
import { ACTIVE, exp, Variable, variable as varRef } from '.';
import {
  EnhancedResource,
  ID,
  MaybeUnsecuredInstance,
  ResourceShape,
  UnwrapSecured,
} from '../../../common';
import { DbChanges } from '../changes';

export type CreatePropertyOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  },
  Key extends keyof DbChanges<TObject> & string
> = MergeExclusive<
  {
    resource: TResourceStatic | EnhancedResource<TResourceStatic>;
    key: Key;
  },
  {
    /**
     * Update a dynamic property.
     * Note that this doesn't set labels declared in the DTO.
     */
    key: Variable;
  }
> & {
  changeset?: ID;
  nodeName?: string;
  numCreatedVar?: string;
} & MergeExclusive<
    {
      /** The new value which will be a bound parameter */
      value: UnwrapSecured<TObject[Key]>;
    },
    {
      /** The variable to use as the new value */
      variable: string;
    }
  >;

/**
 * Creates a new property from the node var with given key/value.
 */
export const createProperty =
  <
    TResourceStatic extends ResourceShape<any>,
    TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
      id: ID;
    },
    Key extends keyof DbChanges<TObject> & string
  >({
    resource,
    key,
    value,
    variable,
    changeset,
    nodeName = 'node',
    numCreatedVar = 'numPropsCreated',
  }: CreatePropertyOptions<TResourceStatic, TObject, Key>) =>
  <R>(query: Query<R>) => {
    resource = resource ? EnhancedResource.of(resource) : undefined;

    const createdAtParam = query.params.addParam(DateTime.local(), 'createdAt');

    // Grab labels for property if it's statically given.
    // Also, do not give properties unique labels if inside a changeset.
    // They'll get them when they are applied for real.
    const propLabels =
      !changeset && resource && typeof key === 'string'
        ? resource.dbPropLabels[key]
        : ['Property'];

    const docSignature = `createProperty(${nodeName}${
      key instanceof Variable ? `[${key.toString()}]` : `.${key}`
    }${variable ? ` = ${variable}` : ''})`;
    return query
      .comment(docSignature)
      .subQuery([nodeName, variable ? varRef(variable) : null], (sub) =>
        sub
          .apply((q) =>
            changeset
              ? q
                  .match(node('changeset', 'Changeset', { id: changeset }))
                  .optionalMatch([
                    node(nodeName),
                    relation(
                      'out',
                      undefined,
                      key instanceof Variable ? [] : key,
                      ACTIVE
                    ),
                    node('existingProp', 'Property'),
                  ])
                  // Don't create a new "change value" if the value is the same as
                  // the value outside the changeset.
                  .raw(
                    compact([
                      'WHERE',
                      key instanceof Variable
                        ? `type(existingProp) = ${key.toString()} AND`
                        : '',
                      `existingProp.value <> ${variable ? variable : '$value'}`,
                    ]).join(' '),
                    variable ? {} : { value }
                  )
              : q
          )
          .subQuery(
            [
              nodeName,
              variable ? varRef(variable) : '',
              changeset ? 'changeset' : '',
            ],
            (sub2) =>
              sub2
                .create([
                  node('newPropNode', propLabels, {
                    createdAt: varRef(createdAtParam.toString()),
                    value: variable ? varRef(variable) : value,
                  }),
                  ...(changeset
                    ? [
                        relation('in', '', 'changeset', ACTIVE),
                        node('changeset'),
                      ]
                    : []),
                ])
                .return(['newPropNode'])
          )
          .raw(
            `CALL apoc.create.relationship(${nodeName}, ${
              key instanceof Variable ? key.toString() : `'${key}'`
            }, ${exp({
              active: !changeset,
              createdAt: createdAtParam.toString(),
            })}, newPropNode) YIELD rel`
          )
          .return(`count(newPropNode) as ${numCreatedVar}`)
      );
  };
