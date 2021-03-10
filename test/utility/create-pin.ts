import { gql } from 'apollo-server-core';
import { TestApp } from './create-app';

export async function createPin(app: TestApp, id: string, pinned?: boolean) {
  const result = await app.graphql.mutate(
    gql`
      mutation togglePinned($id: ID!, $pinned: Boolean) {
        togglePinned(id: $id, pinned: $pinned)
      }
    `,
    {
      id,
      pinned,
    }
  );

  expect(result.togglePinned).toBeDefined();
  return result.togglePinned;
}
