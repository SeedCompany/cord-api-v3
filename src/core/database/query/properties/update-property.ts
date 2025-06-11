import { node, type Query, relation } from 'cypher-query-builder';
import { DateTime, Duration, type DurationLikeObject as MyDuration } from 'luxon';
import {
  type DurationIn,
  type ID,
  type MaybeUnsecuredInstance,
  type ResourceShape,
} from '~/common';
import { type DbChanges } from '../../changes';
import { varInExp } from '../../query-augmentation/subquery';
import { ACTIVE, coalesce, exp, INACTIVE, type QueryFragment, variable, Variable } from '../index';
import { maybeWhereAnd } from '../maybe-where-and';
import { createProperty, type CreatePropertyOptions } from './create-property';
import { deactivateProperty, type DeactivatePropertyOptions } from './deactivate-property';

export const defaultPermanentAfter: MyDuration = { minutes: 30 };

export type UpdatePropertyOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  },
  Key extends keyof DbChanges<TObject> & string,
  StatsVar extends string = 'stats',
> = DeactivatePropertyOptions<TResourceStatic, TObject, Key> &
  CreatePropertyOptions<TResourceStatic, TObject, Key> & {
    /**
     * The property is permanent after this given duration.
     */
    permanentAfter?: Variable | DurationIn;
    outputStatsVar?: StatsVar;
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
    Key extends keyof DbChanges<TObject> & string,
    const StatsVar extends string = 'stats',
  >(
    options: UpdatePropertyOptions<TResourceStatic, TObject, Key, StatsVar>,
  ) =>
  <R>(query: Query<R>): Query<{ [_ in StatsVar]: PropUpdateStat }> => {
    const {
      permanentAfter,
      outputStatsVar = 'stats',
      ...resolved
    } = {
      ...options,
      nodeName: options.nodeName ?? 'node',
      value:
        options.value instanceof Variable
          ? options.value
          : variable(query.params.addParam(options.value, 'value').toString()),
      now: options.now ?? query.params.addParam(DateTime.now(), 'now'),
      permanentAfter: permanentAfterAsVar(options.permanentAfter ?? defaultPermanentAfter, query),
    };
    const { nodeName, key, value, now } = resolved;

    const scope = [
      nodeName,
      resolved.changeset ? varInExp(resolved.changeset) : '',
      key instanceof Variable ? varInExp(key) : '',
      varInExp(value),
    ];
    query.comment('updateProperty()');

    const modifyPermanentProp = (query: Query) =>
      query
        .apply(deactivateProperty<TResourceStatic, TObject, Key>(resolved))
        .apply(createProperty<TResourceStatic, TObject, Key>(resolved))
        .return<{ [_ in StatsVar]: PropUpdateStat }>([
          exp({
            method: '"new entry"',
            deactivated: 'numPropsDeactivated',
            created: 'numPropsCreated',
          }).as(outputStatsVar),
        ]);

    if (!permanentAfter) {
      return query.subQuery(scope, modifyPermanentProp);
    }

    const modifyMutableProp = (query: Query) =>
      query
        .setVariables({
          'existingProp.value': value.toString(),
          'existingProp.modifiedAt': now.toString(),
        })
        .return<{ [_ in StatsVar]: PropUpdateStat }>([
          exp({
            method: '"inline replace"',
            updated: 1,
          }).as(outputStatsVar),
        ]);

    return query
      .apply(loadExistingProp(nodeName, key, resolved.changeset))
      .apply(determineIfPermanent(permanentAfter, now))
      .apply(
        conditionalOn(
          'isPermanent',
          [...scope, 'existingProp'],
          modifyPermanentProp,
          modifyMutableProp,
        ),
      );
  };

const loadExistingProp =
  (nodeName: string, key: string | Variable, changeset?: Variable): QueryFragment =>
  (query) =>
    query
      .optionalMatch([
        node(nodeName),
        relation(
          'out',
          'existingPropRel',
          key instanceof Variable ? [] : key,
          changeset ? INACTIVE : ACTIVE,
        ),
        node('existingProp', 'Property'),
        ...(changeset ? [relation('in', '', 'changeset', ACTIVE), node(changeset.toString())] : []),
      ])
      .apply(maybeWhereAnd(key instanceof Variable && `type(existingPropRel) = ${key.toString()}`));

export const determineIfPermanent =
  (permanentAfter: string, now: Variable, nodeName = 'existingProp'): QueryFragment =>
  (query) =>
    query.subQuery([nodeName], (sub) =>
      sub.return(
        coalesce(
          `coalesce(${nodeName}.modifiedAt, ${nodeName}.createdAt) + ${permanentAfter} < ${now.toString()}`,
          true,
        ).as('isPermanent'),
      ),
    );

export function permanentAfterAsVar(permanentAfter: Variable | DurationIn, query: Query) {
  if (permanentAfter instanceof Variable) {
    return permanentAfter.toString();
  }
  const asObj = Duration.from(permanentAfter);
  if (asObj.as('milliseconds') === 0) {
    return undefined;
  }
  const param = query.params.addParam(asObj, 'permanentAfter');
  return param.toString();
}

export const conditionalOn = <R>(
  conditionVar: string,
  scope: string[],
  trueQuery: QueryFragment<unknown, R>,
  falseQuery: QueryFragment<unknown, R>,
): QueryFragment<unknown, R> => {
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
        .apply(falseQuery),
    );
};
