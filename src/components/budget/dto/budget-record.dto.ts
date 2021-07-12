import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
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

@ObjectType({
  implements: [Resource, ChangesetAware],
})
export class BudgetRecord extends IntersectionType(ChangesetAware, Resource) {
  static readonly Props = keysOf<BudgetRecord>();
  static readonly SecuredProps = keysOf<SecuredProps<BudgetRecord>>();

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
  readonly scope: ScopedRole[];
}
