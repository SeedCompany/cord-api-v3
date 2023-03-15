import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, MaybeUnsecuredInstance, ResourceShape } from '~/common';
import { DbChanges } from '../../changes';
import { prefixNodeLabelsWithDeleted } from '../deletes';
import { ACTIVE, Variable, variable as varRef } from '../index';
import { maybeWhereAnd } from '../maybe-where-and';
import { CommonPropertyOptions } from './common-property-options';

export type DeactivatePropertyOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  },
  Key extends keyof DbChanges<TObject> & string,
> = CommonPropertyOptions<TResourceStatic, TObject, Key> & {
  numDeactivatedVar?: string;
};

/**
 * Deactivates all existing properties of node and given key
 */
export const deactivateProperty =
  <
    TResourceStatic extends ResourceShape<any>,
    TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
      id: ID;
    },
    Key extends keyof DbChanges<TObject> & string,
  >({
    key,
    changeset,
    nodeName = 'node',
    numDeactivatedVar = 'numPropsDeactivated',
    now: nowIn,
  }: DeactivatePropertyOptions<TResourceStatic, TObject, Key>) =>
  <R>(query: Query<R>) => {
    const imports = [nodeName, key instanceof Variable ? key : '', changeset];
    const now = (
      nowIn ?? query.params.addParam(DateTime.now(), 'now')
    ).toString();

    const docKey = key instanceof Variable ? `[${key.toString()}]` : `.${key}`;
    const docSignature = `deactivateProperty(${nodeName}${docKey})`;
    return query.comment(docSignature).subQuery(imports, (sub) =>
      sub
        .match([
          node(nodeName),
          relation('out', 'oldToProp', key instanceof Variable ? [] : key, {
            active: !changeset,
          }),
          node('oldPropVar', 'Property'),
          ...(changeset
            ? [
                relation('in', 'oldChange', 'changeset', ACTIVE),
                node(changeset.toString()),
              ]
            : []),
        ])
        .apply(
          maybeWhereAnd(
            key instanceof Variable && `type(oldToProp) = ${key.toString()}`,
          ),
        )
        .setValues({
          [`${changeset ? 'oldChange' : 'oldToProp'}.active`]: false,
          'oldPropVar.deletedAt': varRef(now),
        })
        .with('oldPropVar')
        .apply(prefixNodeLabelsWithDeleted('oldPropVar'))
        .return(`count(oldPropVar) as ${numDeactivatedVar}`),
    );
  };
