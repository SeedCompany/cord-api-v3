import { gql } from 'apollo-server-core';
import { TestApp } from './create-app';

export async function addFavorite(app: TestApp, baseNodeId: string) {
  const result = await app.graphql.mutate(
    gql`
      mutation addFavorite($input: AddFavoriteInput!) {
        addFavorite(input: $input)
      }
    `,
    {
      input: {
        favorite: {
          baseNodeId: baseNodeId,
        },
      },
    }
  );
  const actual: string = result.addFavorite;
  expect(actual).toBeTruthy();

  return actual;
}
