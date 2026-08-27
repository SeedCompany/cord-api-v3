import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { CalendarDate, generateId, isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

// Deal 3-letter codes from a sequential counter (random start) instead of
// sampling — the unique constraints on ethnologue code/provisional_code make
// random draws collide across a spec file (26³ combos, birthday math). Same
// deck idea as create-location's isoAlpha3.
let ethCodeCounter = faker.number.int({ max: 26 ** 3 - 1 });
const nextEthCode = () => {
  const n = ethCodeCounter++ % 26 ** 3;
  return [(n / 676) | 0, (n / 26) | 0, n]
    .map((part) => String.fromCharCode(97 + (part % 26)))
    .join('');
};

export async function createLanguage(
  app: TestApp,
  input: Partial<InputOf<typeof CreateLanguageDoc>> = {},
) {
  // Against a LOADED database (E2E_REUSE_DB) the random draws can collide
  // with real rows on unique columns — 3,624 loaded languages occupy real
  // RoLV codes and real 3-letter ethnologue codes, so a draw has a few
  // percent chance per call of hitting one. Retry with FRESH draws, and only
  // on uniqueness failures: an explicit value passed by the caller keeps its
  // collision loud, since `input` overrides every regenerated field.
  let lastError: unknown;
  for (const _attempt of Array.from({ length: 5 }).keys()) {
    try {
      return await createLanguageMinimal(app, {
        displayNamePronunciation: faker.lorem.word(),
        isDialect: faker.datatype.boolean(),
        // this represents the largest number that is less than the 32-bit max for GraphQL
        populationOverride: faker.number.int({ max: 2147483647 }),
        registryOfLanguageVarietiesCode: faker.number
          .int({ min: 10000, max: 99999 })
          .toString(),
        leastOfThese: faker.datatype.boolean(),
        leastOfTheseReason: faker.lorem.sentence(),
        ethnologue: {
          code: nextEthCode(),
          provisionalCode: nextEthCode(),
          name: faker.person.firstName(),
          // this represents the largest number that is less than the 32-bit max for GraphQL
          population: faker.number.int({ max: 2147483647 }),
          ...input.ethnologue,
        },
        signLanguageCode:
          faker.helpers.replaceSymbols('??').toUpperCase() +
          faker.number.int({ min: 10, max: 99 }).toString(),
        sponsorEstimatedEndDate: CalendarDate.fromISO('1991-01-01').toISO(),
        tags: ['tag1', 'tag2'],
        ...input,
      });
    } catch (error) {
      if (!String(error).includes('already exists')) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

export async function createLanguageMinimal(
  app: TestApp,
  input: Partial<InputOf<typeof CreateLanguageDoc>> = {},
) {
  const name =
    input.name ?? faker.location.country() + '' + (await generateId());
  const result = await app.graphql.mutate(CreateLanguageDoc, {
    input: {
      displayName: faker.company.name() + '' + (await generateId()),
      ...input,
      name,
    },
  });

  const actual = result.createLanguage.language;

  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(name);

  return actual;
}

const CreateLanguageDoc = graphql(
  `
    mutation createLanguage($input: CreateLanguage!) {
      createLanguage(input: $input) {
        language {
          ...language
        }
      }
    }
  `,
  [fragments.language],
);
