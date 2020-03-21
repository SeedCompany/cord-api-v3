import { gql } from 'apollo-server-core';
import {
  CreatePermission,
  CreatePermissionOutput,
} from '../../src/components/authorization/dto/create-permission.dto';
import { TestApp } from './create-app';

export async function createPermission(app: TestApp, input: CreatePermission) {

  console.log(input);
  
  const result = await app.graphql.mutate(
    gql`
      mutation createPermission($input: CreatePermissionInput!) {
        createPermission(input: $input) {
          id
          success
        }
      }
    `,
    {
      input: {
        request: {
          sgId: input.sgId,
          baseNodeId: input.baseNodeId,
          propertyName: input.propertyName,
          read: input.read,
          write: input.write,
        },
      },
    }
  );

  console.log(result);

  const perm: CreatePermissionOutput = result.createPermission;

  expect(perm.success).toBeTruthy();

  return perm.id;
}
