import { gql } from 'apollo-server-core';
import { Powers } from '../../src/components/authorization/dto/powers';
import { TestApp } from './create-app';
import { login } from './login';

export async function grantPower(app: TestApp, id: string, power: Powers) {
  // Need to login as root user to grant another user the power needed
  // After calling this function, need to login as a normal user again
  await login(app, {
    email: process.env.ROOT_ADMIN_EMAIL,
    password: process.env.ROOT_ADMIN_PASSWORD,
  });

  const result = await app.graphql.mutate(
    gql`
      mutation grantPower($id: ID!, $power: Power!) {
        grantPower(id: $id, power: $power)
      }
    `,
    {
      id: id,
      power: power,
    }
  );
  expect(result.grantPower).toBeTruthy();

  return result.grantPower;
}
