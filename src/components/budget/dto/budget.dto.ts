import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbLabel,
  Resource,
  SecuredProperty,
  SecuredProps,
  Sensitivity,
} from '../../../common';
import { DefinedFile } from '../../file/dto';
import { BudgetRecord } from './budget-record.dto';
import { BudgetStatus } from './budget-status.enum';

@ObjectType({
  implements: [Resource],
})
export class Budget extends Resource {
  static readonly Props = keysOf<Budget>();
  static readonly SecuredProps = keysOf<SecuredProps<Budget>>();

  @Field()
  @DbLabel('BudgetStatus')
  readonly status: BudgetStatus;

  @Field(() => [BudgetRecord])
  readonly records: readonly BudgetRecord[];

  readonly universalTemplateFile: DefinedFile;

  @Field(() => Sensitivity, {
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a budget'),
})
export class SecuredBudget extends SecuredProperty(Budget) {}
