import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  EnhancedResource,
  ID,
  MaybeUnsecuredInstance,
  ResourceShape,
  UnwrapSecured,
} from '~/common';
import { DbChanges } from '../../changes';
import { ACTIVE, exp, Variable, variable as varRef } from '../index';
import { maybeWhereAnd } from '../maybe-where-and';
import { CommonPropertyOptions } from './common-property-options';

export type CreatePropertyOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  },
  Key extends keyof DbChanges<TObject> & string
> = CommonPropertyOptions<TResourceStatic, TObject, Key> & {
  /** The new value which will be a bound parameter */
  value: UnwrapSecured<TObject[Key]> | Variable;
  labels?: string[] | Variable;
  numCreatedVar?: string;
};

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
    changeset,
    nodeName = 'node',
    numCreatedVar = 'numPropsCreated',
    labels,
    now: nowIn,
  }: CreatePropertyOptions<TResourceStatic, TObject, Key>) =>
  <R>(query: Query<R>) => {
    resource = resource ? EnhancedResource.of(resource) : undefined;

    const now = (
      nowIn ?? query.params.addParam(DateTime.now(), 'now')
    ).toString();

    // Grab labels for property if it's statically given.
    // Also, do not give properties unique labels if inside a changeset.
    // They'll get them when they are applied for real.
    const propLabels = Array.isArray(labels)
      ? labels
      : !changeset && resource && typeof key === 'string'
      ? resource.dbPropLabels[key]
      : ['Property'];

    const variable = value instanceof Variable ? value : undefined;

    const imports = [nodeName, variable, changeset];

    const docSignature = `createProperty(${nodeName}${
      key instanceof Variable ? `[${key.toString()}]` : `.${key}`
    }${variable ? ` = ${variable.toString()}` : ''})`;
    return query.comment(docSignature).subQuery(imports, (sub) =>
      sub
        .apply((q) =>
          changeset
            ? q
                .optionalMatch([
                  node(nodeName),
                  relation(
                    'out',
                    'existingPropRel',
                    key instanceof Variable ? [] : key,
                    ACTIVE
                  ),
                  node('existingProp', 'Property'),
                ])
                .apply(
                  maybeWhereAnd(
                    key instanceof Variable &&
                      `type(existingPropRel) = ${key.toString()}`,
                    // Don't create a new "change value" if the value is the same as
                    // the value outside the changeset.
                    `existingProp.value <> ${(
                      variable ?? query.params.addParam(value, 'value')
                    ).toString()}`
                  )
                )
            : q
        )
        .subQuery(imports, (sub2) =>
          sub2
            .create([
              node('newPropNode', propLabels, {
                createdAt: varRef(now),
                value,
              }),
              ...(changeset
                ? [
                    relation('in', '', 'changeset', ACTIVE),
                    node(changeset.toString()),
                  ]
                : []),
            ])
            .return(['newPropNode'])
        )
        .apply((q) =>
          labels instanceof Variable
            ? q.raw(
                `CALL apoc.create.addLabels(newPropNode, ${labels.toString()}) YIELD node as addedLabels`
              )
            : q
        )
        .raw(
          `CALL apoc.create.relationship(${nodeName}, ${
            key instanceof Variable ? key.toString() : `'${key}'`
          }, ${exp({
            active: !changeset,
            createdAt: now,
          })}, newPropNode) YIELD rel`
        )
        .return(`count(newPropNode) as ${numCreatedVar}`)
    );
  };
