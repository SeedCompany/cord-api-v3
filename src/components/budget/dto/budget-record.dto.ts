import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredFloatNullable,
  SecuredInt,
  SecuredKeys,
  SecuredString,
} from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class BudgetRecord extends Resource {
  readonly organization: SecuredString;

  @Field()
  readonly fiscalYear: SecuredInt;

  @Field()
  readonly amount: SecuredFloatNullable;
}

declare module '../../authorization/policies/mapping' {
  interface TypeToDto {
    BudgetRecord: BudgetRecord;
  }
  interface TypeToSecuredProps {
    BudgetRecord: SecuredKeys<BudgetRecord>;
  }
}
