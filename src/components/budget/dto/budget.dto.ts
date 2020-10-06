import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredKeys, SecuredProperty } from '../../../common';
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
}

declare module '../../authorization/policies/mapping' {
  interface TypeToDto {
    Budget: Budget;
  }
  interface TypeToSecuredProps {
    Budget: SecuredKeys<Budget> | 'status' | 'records';
  }
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a budget'),
})
export class SecuredBudget extends SecuredProperty(Budget) {}
