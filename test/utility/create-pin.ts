import { ID } from '../../src/common';
import { TestApp } from './create-app';
import { gql } from './gql-tag';

export async function createPin(app: TestApp, id: ID, pinned?: boolean) {
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
