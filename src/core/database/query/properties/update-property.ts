import { node, Query, relation } from 'cypher-query-builder';
import { DateTime, Duration } from 'luxon';
import {
  DurationIn,
  ID,
  MaybeUnsecuredInstance,
  ResourceShape,
} from '~/common';
import { DbChanges } from '../../changes';
import { varInExp } from '../../query-augmentation/subquery';
import {
  ACTIVE,
  coalesce,
  exp,
  QueryFragment,
  variable,
  Variable,
} from '../index';
import { maybeWhereAnd } from '../maybe-where-and';
import { createProperty, CreatePropertyOptions } from './create-property';
import {
  deactivateProperty,
  DeactivatePropertyOptions,
} from './deactivate-property';

export type UpdatePropertyOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  },
  Key extends keyof DbChanges<TObject> & string
> = DeactivatePropertyOptions<TResourceStatic, TObject, Key> &
  CreatePropertyOptions<TResourceStatic, TObject, Key> & {
    /**
     * The property is permanent after this given duration.
     */
    permanentAfter?: Variable | DurationIn;
  };

export interface PropUpdateStat {
  method: 'inline replace' | 'new entry';
  updated?: number;
  deactivated?: number;
  created?: number;
}

/**
 * Deactivates all existing properties of the given key (if any) and then
 * creates a new property with the given value.
 */
export const updateProperty =
  <
    TResourceStatic extends ResourceShape<any>,
    TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
      id: ID;
    },
    Key extends keyof DbChanges<TObject> & string
  >(
    options: UpdatePropertyOptions<TResourceStatic, TObject, Key>
  ) =>
  <R>(query: Query<R>) => {
    const { permanentAfter, ...resolved } = {
      ...options,
      nodeName: options.nodeName ?? 'node',
      value:
        options.value instanceof Variable
          ? options.value
          : variable(query.params.addParam(options.value, 'value').toString()),
      now: options.now ?? query.params.addParam(DateTime.now(), 'now'),
      permanentAfter: permanentAfterAsVar(options.permanentAfter, query),
    };
    const { nodeName, key, value, now } = resolved;

    query.comment('updateProperty()');

    const modifyPermanentProp: QueryFragment = (query) =>
      query
        .apply(deactivateProperty<TResourceStatic, TObject, Key>(resolved))
        .apply(createProperty<TResourceStatic, TObject, Key>(resolved))
        .return<{ stats: PropUpdateStat }>([
          exp({
            method: '"new entry"',
            deactivated: 'numPropsDeactivated',
            created: 'numPropsCreated',
          }).as('stats'),
        ]);

    if (!permanentAfter) {
      return query.apply(modifyPermanentProp);
    }

    const modifyMutableProp: QueryFragment = (query) =>
      query
        .setVariables({
          'existingProp.value': value.toString(),
          'existingProp.modifiedAt': now.toString(),
        })
        .return<{ stats: PropUpdateStat }>([
          exp({
            method: '"inline replace"',
            updated: 1,
          }).as('stats'),
        ]);

    return query
      .apply(loadExistingProp(nodeName, key))
      .apply(determineIfPermanent(permanentAfter, now))
      .apply(
        conditionalOn(
          'isPermanent',
          [
            nodeName,
            key instanceof Variable ? varInExp(key) : '',
            varInExp(value),
            'existingProp',
          ],
          modifyPermanentProp,
          modifyMutableProp
        )
      );
  };

const loadExistingProp =
  (nodeName: string, key: string | Variable): QueryFragment =>
  (query) =>
    query
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
          key instanceof Variable && `type(existingPropRel) = ${key.toString()}`
        )
      );

const determineIfPermanent =
  (permanentAfter: string, now: Variable): QueryFragment =>
  (query) =>
    query.subQuery(['existingProp'], (sub) =>
      sub.return(
        coalesce(
          `coalesce(existingProp.modifiedAt, existingProp.createdAt) + ${permanentAfter}) < ${now.toString()}`,
          true
        ).as('isPermanent')
      )
    );

function permanentAfterAsVar(
  permanentAfter: Variable | DurationIn | undefined,
  query: Query
) {
  if (permanentAfter instanceof Variable) {
    return permanentAfter.toString();
  }
  if (permanentAfter == null) {
    return undefined;
  }
  const asObj = Duration.from(permanentAfter);
  if (asObj.as('milliseconds') === 0) {
    return undefined;
  }
  const param = query.params.addParam(asObj, 'permanentAfter');
  return param.toString();
}

const conditionalOn = (
  conditionVar: string,
  scope: string[],
  trueQuery: QueryFragment,
  falseQuery: QueryFragment
): QueryFragment => {
  const imports = [...new Set([conditionVar, ...scope])];
  return (query) =>
    query.subQuery((sub) =>
      sub
        .with(imports)
        .with(imports)
        .raw(`WHERE ${conditionVar}`)
        .apply(trueQuery)

        .union()
        .with(imports)
        .with(imports)
        .raw(`WHERE NOT ${conditionVar}`)
        .apply(falseQuery)
    );
};
