import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { BaseNode } from '~/core/database/results';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import {
  ID,
  IntersectionType,
  Resource,
  Secured,
  SecuredFloatNullable,
  SecuredInt,
  SecuredProps,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { ScopedRole } from '../../authorization';
import { ChangesetAware } from '../../changeset/dto';
import { Budget } from './budget.dto';

@RegisterResource({ db: e.Budget.Record })
@ObjectType({
  implements: [Resource, ChangesetAware],
})
export class BudgetRecord extends IntersectionType(ChangesetAware, Resource) {
  static readonly Props = keysOf<BudgetRecord>();
  static readonly SecuredProps = keysOf<SecuredProps<BudgetRecord>>();
  static readonly Parent = import('./budget.dto').then((m) => m.Budget);

  @Field(() => Budget)
  declare readonly parent: BaseNode;

  readonly organization: Secured<ID>;

  @Field()
  readonly fiscalYear: SecuredInt;

  @Field()
  readonly amount: SecuredFloatNullable;

  @SensitivityField({
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;

  // A list of non-global roles the requesting user has available for this object.
  // This is just a cache, to prevent extra db lookups within the same request.
  declare readonly scope: ScopedRole[];
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    BudgetRecord: typeof BudgetRecord;
  }
  interface ResourceDBMap {
    BudgetRecord: typeof e.Budget.Record;
  }
}
