import { type ID } from '~/common';
import { graphql } from '~/graphql';
import { type TestApp } from './create-app';

export async function createPin(app: TestApp, id: ID, pinned?: boolean) {
  const result = await app.graphql.mutate(
    graphql(`
      mutation togglePinned($id: ID!, $pinned: Boolean) {
        togglePinned(id: $id, pinned: $pinned)
      }
    `),
    {
      id,
      pinned,
    },
  );

  expect(result.togglePinned).toBeDefined();
  return result.togglePinned;
}
