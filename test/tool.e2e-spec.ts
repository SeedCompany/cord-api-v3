import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { times } from 'lodash';
import { isValidId, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createSession,
  createTestApp,
  createTool,
  errors,
  fragments,
  registerUser,
  type TestApp,
} from './utility';

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
});
