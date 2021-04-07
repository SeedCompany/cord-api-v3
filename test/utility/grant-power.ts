import { gql } from 'apollo-server-core';
import { ID } from '../../src/common';
import { Powers as Power } from '../../src/components/authorization/dto/powers';
import { TestApp } from './create-app';
import { runAsAdmin } from './login';

export async function grantPower(app: TestApp, userId: ID, power: Power) {
  await runAsAdmin(app, async () => {
    await app.graphql.mutate(
      gql`
        mutation grantPower($userId: ID!, $power: Power!) {
          grantPower(userId: $userId, power: $power)
        }
      `,
      {
        userId,
        power,
      }
    );
  });
}
