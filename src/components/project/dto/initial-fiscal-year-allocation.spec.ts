import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { sql } from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { projects } from '~/core/drizzle/schema';
// Through the barrel, as the app loads it: importing `update-project.dto`
// directly enters a circular import (via the changeset module) mid-way.
import {
  InitialFiscalYearAllocation,
  ProjectType,
  UpdateProject,
} from '../dto';

/**
 * "Initial Fiscal Year Allocation" (cord-field#1902).
 *
 * Who may edit it is policy, and policies need the whole app to resolve, so
 * that is covered in `test/features/project-initial-fiscal-year-allocation.e2e-spec.ts`.
 * This pins the parts that stand alone: which project types carry it, the
 * four-digit rule, and that the database agrees with both.
 */
describe('InitialFiscalYearAllocation', () => {
  describe('appliesTo', () => {
    it.each([
      [ProjectType.MomentumTranslation, true],
      [ProjectType.Internship, true],
      [ProjectType.MultiplicationTranslation, false],
    ])('%s → %s', (type, expected) => {
      expect(InitialFiscalYearAllocation.appliesTo(type)).toBe(expected);
    });

    it('has an answer for every project type', () => {
      // A new project type must be decided on deliberately, not inherit
      // whatever the default branch happens to say.
      const decided = new Set([
        ProjectType.MomentumTranslation,
        ProjectType.Internship,
        ProjectType.MultiplicationTranslation,
      ]);
      expect(new Set(ProjectType.values)).toEqual(decided);
    });
  });

  describe('UpdateProject.initialFiscalYearAllocation validation', () => {
    // Concrete subclass so class-transformer can instantiate it; the
    // validation decorators are inherited.
    class Input extends UpdateProject {}

    // The same option the app's global ValidationPipe uses
    // (`src/core/validation/validation.module.ts`). It is what lets `null`
    // through to clear the field. `id` is left out on purpose: its validator
    // is injectable and needs the app's container, and this option skips it.
    const errorsFor = async (initialFiscalYearAllocation: unknown) => {
      const input = plainToInstance(Input, { initialFiscalYearAllocation });
      const errors = await validate(input, { skipMissingProperties: true });
      return errors
        .filter((e) => e.property === 'initialFiscalYearAllocation')
        .flatMap((e) => Object.values(e.constraints ?? {}));
    };

    it.each([
      ['a current fiscal year', 2027],
      ['the smallest four-digit year', 1000],
      ['the largest four-digit year', 9999],
      ['null, which clears it', null],
      ['undefined, which leaves it alone', undefined],
    ])('accepts %s', async (_, value) => {
      expect(await errorsFor(value)).toEqual([]);
    });

    it.each([
      ['a two-digit year', 27],
      ['a three-digit year', 999],
      ['a five-digit year', 10000],
      ['zero', 0],
      ['a negative year', -2027],
    ])('rejects %s', async (_, value) => {
      expect(await errorsFor(value)).toEqual([
        InitialFiscalYearAllocation.invalidMessage,
      ]);
    });
  });

  describe('projects.initial_fiscal_year_allocation column', () => {
    const config = getTableConfig(projects);

    it('is a nullable integer with no default', () => {
      const column = config.columns.find(
        (c) => c.name === 'initial_fiscal_year_allocation',
      );
      expect(column).toBeDefined();
      expect(column!.getSQLType()).toBe('integer');
      expect(column!.notNull).toBe(false);
      expect(column!.hasDefault).toBe(false);
    });

    it('is held to the same four-digit range by the database as by the API', () => {
      // The schema can't import the DTO, so the range is written there as
      // literals. This keeps the two copies from drifting apart.
      const check = config.checks.find(
        (c) =>
          c.name === 'projects_initial_fiscal_year_allocation_four_digits_chk',
      );
      expect(check).toBeDefined();
      const text = new PgDialect().sqlToQuery(sql`${check!.value}`).sql;
      const { min, max } = InitialFiscalYearAllocation;
      expect(text).toContain(`BETWEEN ${min} AND ${max}`);
    });

    it('is refused by the database on exactly the types appliesTo excludes', () => {
      const check = config.checks.find(
        (c) =>
          c.name ===
          'projects_initial_fiscal_year_allocation_not_multiplication_chk',
      );
      expect(check).toBeDefined();
      const text = new PgDialect().sqlToQuery(sql`${check!.value}`).sql;

      for (const type of ProjectType.values) {
        const named = text.includes(`'${type}'`);
        // The check names the types that may NOT hold a value.
        expect([type, named]).toEqual([
          type,
          !InitialFiscalYearAllocation.appliesTo(type),
        ]);
      }
    });
  });
});
