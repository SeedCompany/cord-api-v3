import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { times } from 'lodash';
import { CalendarDate, isValidId, Order, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createLanguage,
  createLanguageEngagement,
  createOrganization,
  createProject,
  createSession,
  createTestApp,
  createTool,
  errors,
  fragments,
  registerUser,
  runAsAdmin,
  type TestApp,
} from './utility';

/**
 * `usageCount` is a Postgres-only sort (see its test). Skipped rather than
 * silently passing on Neo4j, so the run reports that it did not execute.
 */
const itPostgresOnly = process.env.DATABASE === 'postgres' ? it : it.skip;

describe('Tool e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    // FieldServices has full Tool CRUD; everyone can read.
    await registerUser(app, { roles: [Role.FieldServices] });
  });

  it('create tool', async () => {
    const tool = await createTool(app);
    expect(isValidId(tool.id)).toBe(true);
  });

  it('create & read tool by id', async () => {
    const description = faker.lorem.sentence();
    const created = await createTool(app, { description, aiBased: true });

    const { tool: actual } = await app.graphql.query(
      graphql(
        `
          query tool($id: ID!) {
            tool(id: $id) {
              ...tool
            }
          }
        `,
        [fragments.tool],
      ),
      { id: created.id },
    );
    expect(actual.id).toBe(created.id);
    expect(actual.name.value).toBe(created.name.value);
    expect(actual.description.value).toBe(description);
    expect(actual.aiBased.value).toBe(true);
    expect(actual.key?.value ?? null).toBeNull();
  });

  it('should have unique name', async () => {
    const name = faker.company.name() + faker.string.alpha(5);
    await createTool(app, { name });
    await expect(createTool(app, { name })).rejects.toThrowGqlError(
      errors.duplicate({
        message: 'Tool with this name already exists.',
        field: 'name',
      }),
    );
  });

  it('should have unique key among active tools', async () => {
    // ToolKey is an enum with exactly ONE value (Rev79), so there is no
    // fresh key to claim. On an empty database the first create takes it and
    // the second collides; on a LOADED database the real Rev79 tool already
    // exists and the first create is itself the collision. Either way the
    // asserted create below proves the unique index — so the first one is
    // allowed to fail.
    await createTool(app, { key: 'Rev79' }).catch(() => undefined);
    await expect(createTool(app, { key: 'Rev79' })).rejects.toThrowGqlError(
      errors.duplicate({
        message: 'Key is already assigned to another tool.',
        field: 'key',
      }),
    );
  });

  it('update tool', async () => {
    const tool = await createTool(app);
    const newName = faker.company.name() + faker.string.alpha(5);
    const newDescription = faker.lorem.sentence();

    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateTool($input: UpdateTool!) {
            updateTool(input: $input) {
              tool {
                ...tool
              }
            }
          }
        `,
        [fragments.tool],
      ),
      {
        input: {
          id: tool.id,
          name: newName,
          description: newDescription,
          aiBased: true,
        },
      },
    );
    const updated = result.updateTool.tool;
    expect(updated.id).toBe(tool.id);
    expect(updated.name.value).toBe(newName);
    expect(updated.description.value).toBe(newDescription);
    expect(updated.aiBased.value).toBe(true);
  });

  it('delete tool', async () => {
    const tool = await createTool(app);

    const result = await app.graphql.mutate(
      graphql(`
        mutation deleteTool($id: ID!) {
          deleteTool(id: $id) {
            __typename
          }
        }
      `),
      { id: tool.id },
    );
    expect(result.deleteTool).toBeTruthy();

    await app.graphql
      .query(
        graphql(`
          query tool($id: ID!) {
            tool(id: $id) {
              id
            }
          }
        `),
        { id: tool.id },
      )
      .expectError();
  });

  it('deleted tool name is reusable', async () => {
    const name = faker.company.name() + faker.string.alpha(5);
    const first = await createTool(app, { name });
    await app.graphql.mutate(
      graphql(`
        mutation deleteTool($id: ID!) {
          deleteTool(id: $id) {
            __typename
          }
        }
      `),
      { id: first.id },
    );

    // Soft delete frees the name (partial unique index on live rows only).
    const second = await createTool(app, { name });
    expect(second.id).not.toBe(first.id);
  });

  it('list view of tools', async () => {
    const numTools = 2;
    await Promise.all(times(numTools).map(async () => await createTool(app)));

    const { tools } = await app.graphql.query(
      graphql(
        `
          query {
            tools(input: { count: 25 }) {
              items {
                ...tool
              }
              hasMore
              total
            }
          }
        `,
        [fragments.tool],
      ),
    );

    expect(tools.items.length).toBeGreaterThanOrEqual(numTools);
  });

  it('list filtered by aiBased', async () => {
    const aiTool = await createTool(app, { aiBased: true });
    const nonAiTool = await createTool(app, { aiBased: false });

    const { tools } = await app.graphql.query(
      graphql(
        `
          query {
            tools(input: { count: 25, filter: { aiBased: true } }) {
              items {
                ...tool
              }
            }
          }
        `,
        [fragments.tool],
      ),
    );

    const ids = tools.items.map((tool) => tool.id);
    expect(ids).toContain(aiTool.id);
    expect(ids).not.toContain(nonAiTool.id);
  });

  /**
   * Postgres only, and deliberately: Neo4j's tool list applies the default
   * sorters, and a key with no stored property becomes a required match that
   * eliminates every row — so this sort returns an EMPTY list over there rather
   * than an error. The Tools grid keeps its Usages column unsortable until
   * cutover for that reason (see the UI handoff), so there is no Neo4j behavior
   * to assert.
   */
  itPostgresOnly(
    'sorts by usageCount, counting what the Usages column displays',
    async () => {
      const prefix = faker.string.alpha({ length: 8 });
      const [twoUsages, noneCounted, oneUsage] = await Promise.all([
        createTool(app, { name: `${prefix} Alpha` }),
        createTool(app, { name: `${prefix} Bravo` }),
        createTool(app, { name: `${prefix} Charlie` }),
      ]);

      const project = await createProject(app);
      const language = await runAsAdmin(
        app,
        async () => await createLanguage(app),
      );
      const engagement = await createLanguageEngagement(app, {
        project: project.id,
        language: language.id,
        // `createProject`'s MOU window is 1991→1992, and the engagement helper
        // defaults both dates to today, which lands outside it.
        startDateOverride: CalendarDate.fromISO('1991-01-01').toISO(),
        endDateOverride: CalendarDate.fromISO('1992-01-01').toISO(),
      });
      // Alpha gets one of each counted container type; Charlie one project.
      // Bravo's only usage is on an ORGANIZATION, which the Usages column does
      // not count — any resource can hold a usage, but the summary buckets only
      // projects and engagements — so Bravo has to sort as zero.
      const organization = await runAsAdmin(
        app,
        async () => await createOrganization(app),
      );
      for (const [tool, container] of [
        [twoUsages, project.id],
        [twoUsages, engagement.id],
        [oneUsage, project.id],
        [noneCounted, organization.id],
      ] as const) {
        await app.graphql.mutate(
          graphql(`
            mutation createUsageForSort($container: ID!, $tool: ID!) {
              createToolUsage(input: { container: $container, tool: $tool }) {
                toolUsage {
                  id
                }
              }
            }
          `),
          { container, tool: tool.id },
        );
      }

      const sorted = async (order: Order) => {
        const { tools } = await app.graphql.query(
          graphql(`
            query toolsByUsageCount($input: ToolListInput) {
              tools(input: $input) {
                items {
                  id
                  name {
                    value
                  }
                  containerSummary {
                    total
                  }
                }
              }
            }
          `),
          { input: { sort: 'usageCount', order, filter: { name: prefix } } },
        );
        return tools.items.map((tool) => ({
          label: tool.name.value?.replace(prefix + ' ', ''),
          shown: tool.containerSummary.reduce((sum, c) => sum + c.total, 0),
        }));
      };

      // Name order is Alpha, Bravo, Charlie — the reverse of the count order —
      // so this cannot pass on the `name` fallback.
      const ascending = await sorted(Order.ASC);
      expect(ascending.map((tool) => tool.label)).toEqual([
        'Bravo',
        'Charlie',
        'Alpha',
      ]);
      // The sort counted the same population the column displays.
      expect(ascending.map((tool) => tool.shown)).toEqual([0, 1, 2]);

      const descending = await sorted(Order.DESC);
      expect(descending.map((tool) => tool.label)).toEqual([
        'Alpha',
        'Charlie',
        'Bravo',
      ]);
    },
  );
});
