import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { BaseNode } from '~/core/database/results';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import {
  Calculated,
  DbLabel,
  IntersectionType,
  Resource,
  ResourceRelationsShape,
  SecuredProperty,
  SecuredProps,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { ScopedRole } from '../../authorization';
import { ChangesetAware } from '../../changeset/dto';
import { DefinedFile } from '../../file/dto';
import { IProject } from '../../project/dto';
import { BudgetRecord } from './budget-record.dto';
import { BudgetStatus } from './budget-status.enum';

@Calculated()
@RegisterResource({ db: e.Budget })
@ObjectType({
  implements: [Resource, ChangesetAware],
})
export class Budget extends IntersectionType(ChangesetAware, Resource) {
  static readonly Props = keysOf<Budget>();
  static readonly SecuredProps = keysOf<SecuredProps<Budget>>();
  static readonly Relations = (() => ({
    records: [BudgetRecord],
  })) satisfies ResourceRelationsShape;
  static readonly Parent = import('../../project/dto').then((m) => m.IProject);

  @Field(() => IProject)
  declare readonly parent: BaseNode;

  @Field()
  @DbLabel('BudgetStatus')
  readonly status: BudgetStatus;

  @Field(() => [BudgetRecord])
  readonly records: readonly BudgetRecord[];

  readonly universalTemplateFile: DefinedFile;

  @SensitivityField({
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;

  // A list of non-global roles the requesting user has available for this object.
  // This is just a cache, to prevent extra db lookups within the same request.
  declare readonly scope: ScopedRole[];
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a budget'),
})
export class SecuredBudget extends SecuredProperty(Budget) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Budget: typeof Budget;
  }
  interface ResourceDBMap {
    Budget: typeof e.default.Budget;
  }
}
