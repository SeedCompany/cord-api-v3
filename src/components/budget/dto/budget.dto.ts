import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredBoolean, SecuredProperty } from '../../../common';
import { DefinedFile } from '../../file/dto';
import { BudgetRecord } from './budget-record.dto';
import { BudgetStatus } from './budget-status.enum';

@ObjectType({
  implements: [Resource],
})
export class Budget extends Resource {
  @Field()
  readonly status: BudgetStatus;

  @Field(() => [BudgetRecord])
  readonly records: readonly BudgetRecord[];

  readonly universalTemplateFile: DefinedFile;

  readonly canDelete: SecuredBoolean;
}
@ObjectType({
  description: SecuredProperty.descriptionFor('a budget'),
})
export class SecuredBudget extends SecuredProperty(Budget) {}
