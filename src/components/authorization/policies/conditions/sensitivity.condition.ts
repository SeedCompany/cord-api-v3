import { Query } from 'cypher-query-builder';
import { inspect, InspectOptionsStylized } from 'util';
import { ResourceShape, Sensitivity } from '~/common';
import { matchProjectSens, rankSens } from '~/core/database/query';
import { Condition, IsAllowedParams } from '../../policy/conditions';

const sensitivityRank = { High: 3, Medium: 2, Low: 1 };
const CQL_VAR = 'sens';

const EffectiveSensitivity = Symbol('EffectiveSensitivity');

export type HasSensitivity =
  | { sensitivity: Sensitivity }
  | { [EffectiveSensitivity]: Sensitivity };

export class SensitivityCondition<
  TResourceStatic extends
    | ResourceShape<HasSensitivity>
    | (ResourceShape<any> & {
        ConfirmThisClassPassesSensitivityToPolicies: true;
      })
> implements Condition<TResourceStatic>
{
  constructor(private readonly access: Sensitivity) {}

  isAllowed({ object }: IsAllowedParams<TResourceStatic>) {
    // Double check at runtime that object has these, since they are usually
    // declared from DB which cannot be verified.
    if (!object) {
      throw new Error("Needed object's sensitivity but object wasn't given");
    }
    const actual: Sensitivity | undefined =
      Reflect.get(object, EffectiveSensitivity) ??
      Reflect.get(object, 'sensitivity');

    if (!actual) {
      throw new Error(
        "Needed object's sensitivity but object's sensitivity wasn't given"
      );
    }

    return sensitivityRank[actual] <= sensitivityRank[this.access];
  }

  setupCypherContext(query: Query, prevApplied: Set<any>) {
    if (prevApplied.has('sensitivity')) {
      return query;
    }
    prevApplied.add('sensitivity');

    return query.subQuery('project', (sub) =>
      sub
        .apply(matchProjectSens())
        .return(`${rankSens('sensitivity')} as ${CQL_VAR}`)
    );
  }

  asCypherCondition(query: Query) {
    const ranked = sensitivityRank[this.access];
    const param = query.params.addParam(ranked, 'requiredSens');
    return `${CQL_VAR} <= ${String(param)}`;
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    const map = {
      High: 'Any',
      Medium: 'Medium/Low',
      Low: 'Low',
    };
    return `Sens ${map[this.access]}`;
  }
}

/**
 * The following actions only apply if the object's sensitivity is Medium or Low.
 */
export const sensMediumOrLower = new SensitivityCondition(Sensitivity.Medium);

/**
 * The following actions only apply if the object's sensitivity is Low.
 */
export const sensOnlyLow = new SensitivityCondition(Sensitivity.Low);

/**
 * Specify sensitivity that should be used for the sensitivity condition.
 * This is useful when the object doesn't have a `sensitivity` property or
 * a different/"effective" sensitivity should be used for this logic.
 */
export const withEffectiveSensitivity = <T extends object>(
  obj: T,
  sensitivity: Sensitivity
) =>
  Object.defineProperty(obj, EffectiveSensitivity, {
    value: sensitivity,
    enumerable: false,
  }) as T & { [EffectiveSensitivity]: Sensitivity };
