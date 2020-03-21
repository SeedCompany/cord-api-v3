import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import {
  CreateSecurityGroup,
  CreateSecurityGroupOutput,
} from '../../src/components/authorization/dto/create-security-group.dto';
import { TestApp } from './create-app';

export async function createSecurityGroup(
  app: TestApp,
  input: Partial<CreateSecurityGroup> = {}
) {
  const name = input.name || faker.company.companyName() + ' SG';

  const result = await app.graphql.mutate(
    gql`
      mutation createSecurityGroup($input: CreateSecurityGroupInput!) {
        createSecurityGroup(input: $input) {
          id
          success
        }
      }
    `,
    {
      input: {
        request: {
          name,
        },
      },
    }
  );
  const sg: CreateSecurityGroupOutput = result.createSecurityGroup;

  expect(sg.success).toBeTruthy();

  return sg;
}
