import { applyDecorators } from '@nestjs/common';
import { Field, Int } from '@nestjs/graphql';
import { Max, Min } from 'class-validator';
import { ProjectType } from './project-type.enum';

/**
 * "Initial Fiscal Year Allocation" (cord-field#1902): the fiscal year a
 * project's initial allocation was applied in.
 *
 * Stored as an integer fiscal year, like `BudgetRecord.fiscalYear` and the
 * `fiscalYear()` helpers in `~/common` — FY N runs Oct 1 of N-1 through
 * Sep 30 of N.
 */
export const InitialFiscalYearAllocation = {
  /**
   * A four-digit year. Integers carry no leading zeros, so "four digits" is
   * exactly this range. The database enforces the same range with
   * `projects_initial_fiscal_year_allocation_four_digits_chk`.
   */
  min: 1000,
  max: 9999,
  invalidMessage: 'Must be a four-digit fiscal year',

  description:
    'The fiscal year the initial allocation was applied in. ' +
    'Not applicable to Multiplication projects.',

  /**
   * Whether projects of this type track the field at all. Every type does
   * except Multiplication. The database enforces the same rule with
   * `projects_initial_fiscal_year_allocation_not_multiplication_chk`.
   */
  appliesTo: (type: ProjectType) =>
    type !== ProjectType.MultiplicationTranslation,
} as const;

/** The input field. */
export const InitialFiscalYearAllocationField = () =>
  applyDecorators(
    Field(() => Int, {
      nullable: true,
      description: InitialFiscalYearAllocation.description,
    }),
    Min(InitialFiscalYearAllocation.min, {
      message: InitialFiscalYearAllocation.invalidMessage,
    }),
    Max(InitialFiscalYearAllocation.max, {
      message: InitialFiscalYearAllocation.invalidMessage,
    }),
  );
