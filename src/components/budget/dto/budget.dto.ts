import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Calculated,
  DbLabel,
  IntersectTypes,
  Resource,
  ResourceRelationsShape,
  SecuredProperty,
  SecuredProps,
  Sensitivity,
  SensitivityField,
} from '~/common';
import { BaseNode } from '~/core/database/results';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { ChangesetAware } from '../../changeset/dto';
import { DefinedFile } from '../../file/dto';
import { IProject } from '../../project/dto';
import { BudgetRecord } from './budget-record.dto';
import { BudgetStatus } from './budget-status.enum';

const Interfaces = IntersectTypes(Resource, ChangesetAware);

@Calculated()
@RegisterResource({ db: e.Budget })
@ObjectType({
  implements: Interfaces.members,
})
export class Budget extends Interfaces {
  static readonly Props = keysOf<Budget>();
  static readonly SecuredProps = keysOf<SecuredProps<Budget>>();
  static readonly Relations = (() => ({
    records: [BudgetRecord],
  })) satisfies ResourceRelationsShape;
  static readonly Parent = () =>
    import('../../project/dto').then((m) => m.IProject);

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
