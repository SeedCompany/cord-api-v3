import { Field, Float, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type ID, IdField, OptionalField } from '~/common';
import { ChangesetIdField } from '../../changeset';
import { CreateDefinedFileVersion } from '../../file/dto';
import { BudgetRecord } from './budget-record.dto';
import { type BudgetStatus } from './budget-status.enum';
import { Budget } from './budget.dto';

@InputType()
export abstract class UpdateBudget {
  @IdField()
  readonly id: ID;

  readonly status?: BudgetStatus | undefined;

  @Field({
    description: 'New version of the universal budget template',
    nullable: true,
  })
  @Type(() => CreateDefinedFileVersion)
  @ValidateNested()
  readonly universalTemplateFile?: CreateDefinedFileVersion;

  // ── budget-line-items-poc additions ──
  //
  // `country` and `languageCount` were removed from here in phase 3 — both
  // are now purely server-derived (see their doc comments on `Budget` in
  // `budget.dto.ts`) rather than client-settable. `country` in particular
  // used to be settable here; it no longer is.

  @OptionalField(() => String, {
    description:
      "'USD' or 'Local' — see BudgetLineItem.costType for why this isn't an enum.",
  })
  readonly entryCurrencyMode?: string;

  @OptionalField(() => String)
  readonly displayCurrencyMode?: string;

  @OptionalField(() => Float)
  readonly exchangeRate?: number;

  @OptionalField(() => Float)
  readonly inflationRate?: number;

  @OptionalField(() => Float)
  readonly adminFeePercent?: number;
}

@ObjectType()
export abstract class BudgetUpdated {
  @Field()
  readonly budget: Budget;
}

@InputType()
export abstract class UpdateBudgetRecord {
  @IdField()
  readonly id: ID;

  @Field(() => Float, { nullable: true })
  readonly amount: number | null;

  @Field(() => Float, { nullable: true })
  readonly preApprovedAmount?: number | null;

  @Field(() => Float, { nullable: true })
  readonly initialAmount?: number | null;

  @ChangesetIdField()
  readonly changeset?: ID;
}

@ObjectType()
export abstract class BudgetRecordUpdated {
  @Field()
  readonly budgetRecord: BudgetRecord;
}
