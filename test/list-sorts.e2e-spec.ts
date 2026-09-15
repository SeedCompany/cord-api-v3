import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { CalendarDate, Order } from '~/common';
import { graphql } from '~/graphql';
import {
  createLanguage,
  createLanguageEngagement,
  createLanguageMinimal,
  createPerson,
  createProject,
  createSession,
  createTestApp,
  createTool,
  createUnavailability,
  registerUser,
  runAsAdmin,
  type TestApp,
} from './utility';

/**
 * Sorts that reach ACROSS domains, plus where each engine puts blanks.
 *
 * Its own spec rather than one per domain because that is the shape of the
 * thing being tested: an engagement sorted by `project.name` exercises the
 * engagement repository, the project repository's sort map, and the shared
 * order-by helper together, and the same is true of every case below. The file
 * runs against both engines, and every case asserts an order they have to agree
 * on — except `nameProjectLast`, which disagrees on purpose and asserts a
 * different answer per engine.
 *
 * Every fixture set is scoped by a random name prefix and given labels whose
 * alphabetical order DISAGREES with the order under test. That is deliberate:
 * an unsupported sort key does not error, it silently orders by the list's
 * fallback column, so a fixture set whose name order matches the expected order
 * would pass without the sort working at all.
 */
/** Same engine gate the audit-log spec uses — `DATABASE`, not `DATABASE_ENGINE`. */
const isPostgres = process.env.DATABASE === 'postgres';

/**
 * Reported as SKIPPED on Neo4j rather than passing silently — `it.skip`, not an
 * early `return`, which jest counts as a pass.
 */
const itPostgresOnly = isPostgres ? it : it.skip;

describe('cross-domain list sorts', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app);
  });

  /**
   * One project + one language + the engagement joining them. Defined out here
   * rather than inline because the fixtures are built in a loop, and a closure
   * over `app` declared inside a loop is a lint error.
   */
  const createEngagementFixture = async (
    projectName: string,
    language: Parameters<typeof createLanguage>[1] = {},
  ) => {
    const project = await createProject(app, { name: projectName });
    const created = await runAsAdmin(
      app,
      async () => await createLanguage(app, language),
    );
    await createLanguageEngagement(app, {
      project: project.id,
      language: created.id,
      // `createProject`'s MOU window is 1991→1992, and the engagement helper
      // defaults both dates to today, which lands outside it.
      startDateOverride: CalendarDate.fromISO('1991-01-01').toISO(),
      endDateOverride: CalendarDate.fromISO('1992-01-01').toISO(),
    });
  };

  const engagementsSortedBy = async (
    sort: string,
    order: Order,
    projectNamePrefix: string,
  ) => {
    const { engagements } = await app.graphql.query(
      graphql(`
        query SortedEngagements($input: EngagementListInput) {
          engagements(input: $input) {
            total
            items {
              id
              ... on LanguageEngagement {
                project {
                  name {
                    value
                  }
                }
                language {
                  value {
                    name {
                      value
                    }
                    ethnologue {
                      code {
                        value
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `),
      {
        input: {
          sort,
          order,
          filter: { project: { name: projectNamePrefix } },
        },
      },
    );
    return engagements.items.map((engagement) =>
      'project' in engagement
        ? engagement.project.name.value?.replace(projectNamePrefix + ' ', '')
        : '?',
    );
  };

  it('engagements by project.name — the default sort of every engagement grid', async () => {
    const prefix = faker.string.alpha({ length: 8 });
    // Created in an order that disagrees with project-name order, so the
    // `createdAt` fallback is distinguishable from a real project.name sort.
    for (const label of ['Charlie', 'Alpha', 'Bravo']) {
      await createEngagementFixture(`${prefix} ${label}`);
    }

    expect(
      await engagementsSortedBy('project.name', Order.ASC, prefix),
    ).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(
      await engagementsSortedBy('project.name', Order.DESC, prefix),
    ).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });

  it('engagements by a two-hop language.ethnologue.code', async () => {
    const prefix = faker.string.alpha({ length: 8 });
    // Ethnologue code order is the REVERSE of project-name order here.
    for (const [label, code] of [
      ['Alpha', 'zqc'],
      ['Bravo', 'zqb'],
      ['Charlie', 'zqa'],
    ] as const) {
      await createEngagementFixture(`${prefix} ${label}`, {
        ethnologue: { code },
      });
    }

    expect(
      await engagementsSortedBy('language.ethnologue.code', Order.ASC, prefix),
    ).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });

  it('engagements by language.population — a delegated coalesce', async () => {
    const prefix = faker.string.alpha({ length: 8 });
    // Population order is a third permutation of the labels, and each
    // language's override disagrees with its ethnologue number, so the sort
    // has to coalesce the pair rather than read either one alone. Bravo has no
    // override at all, which is the case that has to fall through.
    for (const [label, population, populationOverride] of [
      ['Alpha', 900, 200],
      ['Bravo', 100, null],
      ['Charlie', 50, 300],
    ] as const) {
      await createEngagementFixture(`${prefix} ${label}`, {
        populationOverride,
        ethnologue: { population },
      });
    }

    // Reaching a language column from a query over `engagements` means reading
    // it back through the foreign key. The override used to be referenced as a
    // bare `languages` column here, which Postgres rejects outright when no
    // `languages` row is in scope — so this key errored rather than sorting.
    expect(
      await engagementsSortedBy('language.population', Order.ASC, prefix),
    ).toEqual(['Bravo', 'Alpha', 'Charlie']);
  });

  it('engagements by project.name, which IS case-folded', async () => {
    const prefix = faker.string.alpha({ length: 8 });
    for (const label of ['Zebra', 'apple']) {
      await createEngagementFixture(`${prefix} ${label}`);
    }

    // Folded, so `apple` leads. Neo4j folds a name where `DbSort` finds a
    // transformer for the sorted field, and this key resolves to Project's
    // `@NameField` name; raw code points would lead with `Zebra`.
    expect(
      await engagementsSortedBy('project.name', Order.ASC, prefix),
    ).toEqual(['apple', 'Zebra']);
  });

  it('engagements by nameProjectLast — display name on Postgres, name on Neo4j', async () => {
    const prefix = faker.string.alpha({ length: 8 });
    // Each language's name and display name point at OPPOSITE answers, and
    // neither answer is what case-folding would give, so this one fixture set
    // separates all three possibilities.
    await createEngagementFixture(`${prefix} First`, {
      name: `${prefix} Zulu`,
      displayName: `${prefix} apple`,
    });
    await createEngagementFixture(`${prefix} Second`, {
      name: `${prefix} alpha`,
      displayName: `${prefix} Bravo`,
    });

    // The grid's "Language / Intern" column SHOWS the language's display name,
    // so Postgres sorts by that (decided 2026-09-10) while Neo4j still sorts by
    // the language's `name` — the one sort in the app that intentionally
    // disagrees between the engines. Neither is case-folded: `Zulu` before
    // `alpha`, `Bravo` before `apple`, capitals first.
    expect(
      await engagementsSortedBy('nameProjectLast', Order.ASC, prefix),
    ).toEqual(isPostgres ? ['Second', 'First'] : ['First', 'Second']);
  });

  const languagesSortedBy = async (
    sort: string,
    order: Order,
    prefix: string,
  ) => {
    const { languages } = await app.graphql.query(
      graphql(`
        query SortedLanguages($input: LanguageListInput) {
          languages(input: $input) {
            total
            items {
              name {
                value
              }
            }
          }
        }
      `),
      { input: { sort, order, filter: { name: prefix } } },
    );
    return languages.items.map((language) =>
      language.name.value?.replace(prefix + ' ', ''),
    );
  };

  it('languages by ethnologue.code, population and signLanguageCode', async () => {
    const prefix = faker.string.alpha({ length: 8 });
    // Each key's order is a different permutation of the three labels, so no
    // one assertion can pass on another key's ordering — or on the `name`
    // fallback, which is alphabetical.
    await runAsAdmin(app, async () => {
      await createLanguageMinimal(app, {
        name: `${prefix} Alpha`,
        ethnologue: { code: 'zqc', population: 900 },
        populationOverride: 200,
        signLanguageCode: 'ZQ11',
      });
      await createLanguageMinimal(app, {
        name: `${prefix} Bravo`,
        ethnologue: { code: 'zqa', population: 100 },
        signLanguageCode: 'ZQ33',
      });
      await createLanguageMinimal(app, {
        name: `${prefix} Charlie`,
        ethnologue: { code: 'zqb', population: 300 },
        signLanguageCode: 'ZQ22',
      });
    });

    expect(
      await languagesSortedBy('ethnologue.code', Order.ASC, prefix),
    ).toEqual(['Bravo', 'Charlie', 'Alpha']);
    // Bravo has no override, so it sorts by its ethnologue population (100);
    // Alpha's override (200) wins over its ethnologue value (900). Both engines
    // sort by the same coalesced number the API returns as `population`.
    expect(await languagesSortedBy('population', Order.ASC, prefix)).toEqual([
      'Bravo',
      'Alpha',
      'Charlie',
    ]);
    expect(
      await languagesSortedBy('signLanguageCode', Order.ASC, prefix),
    ).toEqual(['Alpha', 'Charlie', 'Bravo']);
  });

  it('puts blanks last in BOTH directions', async () => {
    const prefix = faker.string.alpha({ length: 8 });
    await runAsAdmin(app, async () => {
      await createLanguageMinimal(app, {
        name: `${prefix} Charlie`,
        registryOfLanguageVarietiesCode: '11111',
      });
      await createLanguageMinimal(app, {
        name: `${prefix} Alpha`,
        registryOfLanguageVarietiesCode: '22222',
      });
      await createLanguageMinimal(app, { name: `${prefix} Bravo` });
    });

    // Postgres puts nulls last on ASC but FIRST on DESC by default, while
    // Neo4j puts them last both ways (`sortWith` orders DESC by
    // `[sortValue IS NOT NULL, sortValue]` for exactly this reason). Without
    // the `nulls last` in `orderEntry`, the DESC case here returns
    // `Bravo | Alpha | Charlie` on Postgres.
    expect(
      await languagesSortedBy(
        'registryOfLanguageVarietiesCode',
        Order.ASC,
        prefix,
      ),
    ).toEqual(['Charlie', 'Alpha', 'Bravo']);
    expect(
      await languagesSortedBy(
        'registryOfLanguageVarietiesCode',
        Order.DESC,
        prefix,
      ),
    ).toEqual(['Alpha', 'Charlie', 'Bravo']);
  });

  /**
   * Progress reports are generated per quarter of the engagement's date range,
   * so each fixture engagement contributes several rows. The assertions below
   * therefore check GROUPING — every report of one project ahead of every
   * report of the other — rather than a fixed row count.
   */
  const progressReportProjectsSortedBy = async (
    sort: string,
    order: Order,
    prefix: string,
  ) => {
    const { progressReports } = await app.graphql.query(
      graphql(`
        query SortedProgressReports($input: ProgressReportListInput) {
          progressReports(input: $input) {
            total
            items {
              id
              parent {
                id
                project {
                  name {
                    value
                  }
                }
                language {
                  value {
                    displayName {
                      value
                    }
                  }
                }
              }
            }
          }
        }
      `),
      {
        input: {
          sort,
          order,
          count: 50,
          filter: { engagement: { project: { name: prefix } } },
        },
      },
    );
    return progressReports.items.map((report) =>
      report.parent.project.name.value?.replace(prefix + ' ', ''),
    );
  };

  const createReportingEngagement = async (
    projectName: string,
    languageDisplayName: string,
  ) => {
    const project = await createProject(app, {
      name: projectName,
      mouStart: CalendarDate.fromISO('2020-01-01').toISO(),
      mouEnd: CalendarDate.fromISO('2020-12-31').toISO(),
    });
    const language = await runAsAdmin(
      app,
      async () =>
        await createLanguage(app, { displayName: languageDisplayName }),
    );
    await createLanguageEngagement(app, {
      project: project.id,
      language: language.id,
      startDateOverride: CalendarDate.fromISO('2020-01-01').toISO(),
      endDateOverride: CalendarDate.fromISO('2020-06-30').toISO(),
    });
  };

  it('progress reports by engagement.project.name — the dashboard widget sort', async () => {
    const prefix = faker.string.alpha({ length: 8 });
    // Created in reverse name order, and the language display names run
    // opposite to the project names, so each of the two keys below has its own
    // distinguishable answer and neither matches the `start` fallback.
    await createReportingEngagement(`${prefix} Bravo`, `${prefix} Alpha lang`);
    await createReportingEngagement(`${prefix} Alpha`, `${prefix} Bravo lang`);

    const ascending = await progressReportProjectsSortedBy(
      'engagement.project.name',
      Order.ASC,
      prefix,
    );
    expect(ascending.length).toBeGreaterThanOrEqual(4);
    // Grouped, not interleaved: every Alpha report ahead of every Bravo one.
    expect(ascending).toEqual(
      [...ascending].sort((a, b) => (a ?? '').localeCompare(b ?? '')),
    );
    expect(new Set(ascending)).toEqual(new Set(['Alpha', 'Bravo']));

    // The dashboard's third sortable column. Its ORDER can't be asserted here
    // — progress summaries come from PnP extraction and no fixture can create
    // them, so every fixture report ties at blank — but this does prove the
    // expression is valid SQL and keeps every row, which is what an unverified
    // sort expression most plausibly gets wrong.
    const bySchedule = await progressReportProjectsSortedBy(
      'cumulativeSummary.scheduleStatus',
      Order.ASC,
      prefix,
    );
    expect(new Set(bySchedule)).toEqual(new Set(ascending));
    expect(bySchedule).toHaveLength(ascending.length);

    const descending = await progressReportProjectsSortedBy(
      'engagement.project.name',
      Order.DESC,
      prefix,
    );
    expect(descending).toEqual([...ascending].reverse());
  });

  it('progress reports by a two-hop engagement.language.displayName', async () => {
    const prefix = faker.string.alpha({ length: 8 });
    await createReportingEngagement(`${prefix} Bravo`, `${prefix} Alpha lang`);
    await createReportingEngagement(`${prefix} Alpha`, `${prefix} Bravo lang`);

    // The language named "Alpha lang" belongs to project "Bravo", so ordering
    // by the language name puts the Bravo reports first — the opposite of the
    // project-name sort above, and of the `start` fallback.
    const byLanguage = await progressReportProjectsSortedBy(
      'engagement.language.displayName',
      Order.ASC,
      prefix,
    );
    expect(byLanguage.length).toBeGreaterThanOrEqual(4);
    expect(byLanguage[0]).toBe('Bravo');
    expect(byLanguage.at(-1)).toBe('Alpha');
  });

  it('tools by aiBased', async () => {
    const prefix = faker.string.alpha({ length: 8 });
    await runAsAdmin(app, async () => {
      await createTool(app, { name: `${prefix} Alpha`, aiBased: true });
      await createTool(app, { name: `${prefix} Bravo`, aiBased: false });
    });

    const sorted = async (order: Order) => {
      const { tools } = await app.graphql.query(
        graphql(`
          query SortedTools($input: ToolListInput) {
            tools(input: $input) {
              items {
                name {
                  value
                }
                aiBased {
                  value
                }
              }
            }
          }
        `),
        { input: { sort: 'aiBased', order, filter: { name: prefix } } },
      );
      return tools.items.map((tool) => tool.aiBased.value);
    };

    expect(await sorted(Order.ASC)).toEqual([false, true]);
    expect(await sorted(Order.DESC)).toEqual([true, false]);
  });

  it('users by title', async () => {
    const prefix = faker.string.alpha({ length: 8 });
    await runAsAdmin(app, async () => {
      await createPerson(app, {
        realFirstName: `${prefix}Alpha`,
        title: `${prefix} Zulu`,
      });
      await createPerson(app, {
        realFirstName: `${prefix}Bravo`,
        title: `${prefix} Mike`,
      });
    });

    const { users } = await app.graphql.query(
      graphql(`
        query SortedUsers($input: UserListInput) {
          users(input: $input) {
            items {
              title {
                value
              }
            }
          }
        }
      `),
      {
        input: { sort: 'title', order: Order.ASC, filter: { name: prefix } },
      },
    );
    expect(users.items.map((user) => user.title.value)).toEqual([
      `${prefix} Mike`,
      `${prefix} Zulu`,
    ]);
  });

  it('users by fullName — ONE concatenated string, not first-then-last', async () => {
    // Neo4j's matching sorter concatenates first and last name and orders that
    // one string (`multiPropsAsSortString`). Ordering by first name and then by
    // last name is NOT the same thing: the two disagree whenever one first name
    // is a prefix of another, which real names do constantly.
    //
    // These two fixtures are chosen so the answers differ AND both engines can
    // assert the same one. The names diverge at the character after `Ann`:
    //   concatenated -> "annvan dyke" vs "annabrown" => Anna Brown first
    //   two columns  -> "Ann"         vs "Anna"      => Ann van Dyke first
    // A lower-case surname initial is what makes it engine-neutral — this key
    // is collated on Postgres and raw code points on Neo4j (a registered known
    // delta), and those two agree only while the deciding characters share a
    // case.
    const prefix = faker.string.alpha({ length: 8 });
    await runAsAdmin(app, async () => {
      await createPerson(app, {
        realFirstName: `${prefix}Ann`,
        realLastName: 'van Dyke',
        displayFirstName: `${prefix}Ann`,
        displayLastName: 'van Dyke',
      });
      await createPerson(app, {
        realFirstName: `${prefix}Anna`,
        realLastName: 'Brown',
        displayFirstName: `${prefix}Anna`,
        displayLastName: 'Brown',
      });
    });

    const { users } = await app.graphql.query(
      graphql(`
        query SortedUsersByFullName($input: UserListInput) {
          users(input: $input) {
            items {
              fullName
            }
          }
        }
      `),
      {
        input: { sort: 'fullName', order: Order.ASC, filter: { name: prefix } },
      },
    );
    expect(users.items.map((user) => user.fullName)).toEqual([
      `${prefix}Anna Brown`,
      `${prefix}Ann van Dyke`,
    ]);
  });

  /**
   * FOUR fixtures, not two. An unsupported sort key does not error — the list
   * falls back to its id column, and ids are random, so a two-row set would
   * come back in creation order half the time whether the key works or not.
   */
  const createdAtFixtureCount = 4;

  /**
   * Assert a list came back oldest-first and holds exactly the rows created.
   *
   * Checks the ORDER of `createdAt` rather than an exact sequence of ids,
   * because two rows can in principle share a timestamp. The fixtures are
   * separate awaited mutations so in practice they never do, but nothing adds
   * a tie-breaker — `resolveOrderBy` returns only the resolved entry — so on a
   * tie the order is undefined and an exact sequence would flake.
   *
   * It gives up no falsifying power. With the key missing the list orders by
   * its random id fallback, and an arbitrary order of four rows is sorted by
   * creation time about once in twenty-four.
   */
  const expectOldestFirst = (
    rows: ReadonlyArray<{ id: string; createdAt: string }>,
    createdIds: readonly string[],
  ) => {
    expect(new Set(rows.map((row) => row.id))).toEqual(new Set(createdIds));
    const times = rows.map((row) => new Date(row.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  };

  it('users by createdAt', async () => {
    const prefix = faker.string.alpha({ length: 8 });
    // Named in REVERSE creation order, so neither the id fallback nor a name
    // sort can produce the expected answer by accident.
    const labels = ['Delta', 'Charlie', 'Bravo', 'Alpha'];
    const created: string[] = [];
    await runAsAdmin(app, async () => {
      for (const label of labels) {
        const person = await createPerson(app, {
          realFirstName: `${prefix}${label}`,
        });
        created.push(person.id);
      }
    });

    const { users } = await app.graphql.query(
      graphql(`
        query SortedUsersByCreatedAt($input: UserListInput) {
          users(input: $input) {
            items {
              id
              createdAt
            }
          }
        }
      `),
      {
        input: {
          sort: 'createdAt',
          order: Order.ASC,
          filter: { name: prefix },
        },
      },
    );
    expectOldestFirst(users.items, created);
  });

  it('educations and unavailabilities by createdAt', async () => {
    const person = await runAsAdmin(
      app,
      async () => await createPerson(app, {}),
    );

    const educations: string[] = [];
    const unavailabilities: string[] = [];
    await runAsAdmin(app, async () => {
      for (const index of Array.from({
        length: createdAtFixtureCount,
      }).keys()) {
        const { createEducation } = await app.graphql.mutate(
          graphql(`
            mutation CreateEducationForSort($input: CreateEducation!) {
              createEducation(input: $input) {
                education {
                  id
                }
              }
            }
          `),
          {
            input: {
              user: person.id,
              degree: 'Associates',
              major: `Major ${createdAtFixtureCount - index}`,
              // Institution is this list's DEFAULT sort, so labelling these in
              // reverse keeps the default from answering the question for us.
              institution: `Institution ${createdAtFixtureCount - index}`,
            },
          },
        );
        educations.push(createEducation.education.id);

        const unavailability = await createUnavailability(app, {
          user: person.id,
        });
        unavailabilities.push(unavailability.id);
      }
    });

    const { user } = await runAsAdmin(
      app,
      async () =>
        await app.graphql.query(
          graphql(`
            query SortedSubListsByCreatedAt(
              $id: ID!
              $education: EducationListInput
              $unavailability: UnavailabilityListInput
            ) {
              user(id: $id) {
                education(input: $education) {
                  items {
                    id
                    createdAt
                  }
                }
                unavailabilities(input: $unavailability) {
                  items {
                    id
                    createdAt
                  }
                }
              }
            }
          `),
          {
            id: person.id,
            education: { sort: 'createdAt', order: Order.ASC },
            unavailability: { sort: 'createdAt', order: Order.ASC },
          },
        ),
    );
    expectOldestFirst(user.education.items, educations);
    expectOldestFirst(user.unavailabilities.items, unavailabilities);
  });

  itPostgresOnly(
    'treats an inherited property name as an unknown sort key',
    async () => {
      const prefix = faker.string.alpha({ length: 8 });
      await runAsAdmin(app, async () => {
        await createLanguageMinimal(app, { name: `${prefix} Alpha` });
      });

      // `sort` is a plain String validated only against `/^[A-Za-z0-9_.]+$/`
      // (`SortablePaginationInput`), so `constructor` is a request anyone can
      // send. Looked up in a plain object it answers with Object's own
      // constructor — truthy, and indistinguishable from a real entry — which
      // Drizzle then binds as a query parameter. The list has to fall back
      // instead, the way any other unknown key does.
      expect(await languagesSortedBy('constructor', Order.ASC, prefix)).toEqual(
        ['Alpha'],
      );
    },
  );
});
