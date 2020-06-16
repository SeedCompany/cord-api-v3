import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { CreateSecurityGroupOutput } from '../src/components/authorization/dto/create-security-group.dto';
import { Organization } from '../src/components/organization';
import { User } from '../src/components/user';
import {
  addState,
  createOrganization,
  createPermission,
  createSecurityGroup,
  createSession,
  createTestApp,
  createUser,
  createWorkflow,
  login,
  TestApp,
} from './utility';

describe.skip('Workflow e2e', () => {
  let app: TestApp;
  let org: Organization;
  let sg: CreateSecurityGroupOutput;
  const password: string = faker.internet.password();
  const email = `${faker.internet.email()} ${Date.now()}`;
  let user: User;

  beforeAll(async () => {
    process.env = Object.assign(process.env, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ROOT_ADMIN_EMAIL: 'admin@admin.admin',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ROOT_ADMIN_PASSWORD: 'admin',
    });
    app = await createTestApp();
    await createSession(app);
    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });
    sg = await createSecurityGroup(app);

    user = await createUser(app, { password: password, email: email });

    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });
    await app.graphql.mutate(
      gql`
        mutation attachUserToSecurityGroup($sgId: ID!, $userId: ID!) {
          attachUserToSecurityGroup(
            input: { request: { sgId: $sgId, userId: $userId } }
          )
        }
      `,
      {
        sgId: sg.id,
        userId: user.id,
      }
    );
    await login(app, { email, password });
    org = await createOrganization(app);
    await createPermission(app, {
      sgId: sg.id!,
      baseNodeId: org.id,
      propertyName: 'name',
      read: true,
      write: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('create a workflow', async () => {
    await login(app, { email, password });
    const workflow = await createWorkflow(app, { baseNodeId: org.id });
    expect(workflow).toBeTruthy();
  });

  it('delete a workflow', async () => {
    const workflow = await createWorkflow(app, { baseNodeId: org.id });
    const result = await app.graphql.mutate(
      gql`
        mutation deleteWorkflow($id: ID!) {
          deleteWorkflow(id: $id)
        }
      `,
      {
        id: workflow.id,
      }
    );

    const actual: boolean | undefined = result.deleteWorkflow;
    expect(actual).toBeTruthy();
  });

  it('add a state to workflow', async () => {
    const workflow = await createWorkflow(app, { baseNodeId: org.id });
    const state = await addState(app, { workflowId: workflow.id });
    expect(state).toBeTruthy();
  });

  it('update a state', async () => {
    const workflow = await createWorkflow(app, { baseNodeId: org.id });
    const toState = await addState(app, { workflowId: workflow.id });

    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    await app.graphql.mutate(
      gql`
        mutation attachSecurityGroup($input: GroupStateInput!) {
          attachSecurityGroup(input: $input)
        }
      `,
      {
        input: {
          groupState: {
            stateId: workflow.startingState.id,
            securityGroupId: sg.id,
          },
        },
      }
    );

    await login(app, {
      email,
      password,
    });

    await app.graphql.mutate(
      gql`
        mutation addPossibleState($input: PossibleStateInput!) {
          addPossibleState(input: $input)
        }
      `,
      {
        input: {
          state: {
            fromStateId: workflow.startingState.id,
            toStateId: toState.id,
          },
        },
      }
    );

    const updateStateName = faker.name.title();
    const result = await app.graphql.mutate(
      gql`
        mutation updateState($input: UpdateStateInput!) {
          updateState(input: $input) {
            state {
              id
              value
            }
          }
        }
      `,
      {
        input: {
          state: {
            stateId: toState.id,
            workflowId: workflow.id,
            stateName: updateStateName,
          },
        },
      }
    );

    expect(result.updateState.state.id).toBeTruthy();
    expect(result.updateState.state.value).toBe(updateStateName);
  });

  it('delete an State from Workflow', async () => {
    await login(app, {
      email: email,
      password: password,
    });
    const workflow = await createWorkflow(app, { baseNodeId: org.id });
    const state = await addState(app, { workflowId: workflow.id });
    const result = await app.graphql.mutate(
      gql`
        mutation deleteState($id: ID!) {
          deleteState(id: $id)
        }
      `,
      {
        id: state.id,
      }
    );

    const actual: boolean | undefined = result.deleteState;
    expect(actual).toBeTruthy();
  });

  it('look up all states on workflow', async () => {
    const workflow = await createWorkflow(app, { baseNodeId: org.id });
    const stateNum = 2;
    await Promise.all(
      times(stateNum).map(() =>
        addState(app, {
          workflowId: workflow.id,
        })
      )
    );

    const { states } = await app.graphql.query(
      gql`
        query states($id: ID!) {
          states(id: $id) {
            items {
              id
              value
            }
          }
        }
      `,
      {
        id: org.id,
      }
    );

    expect(states.items.length).toBeGreaterThanOrEqual(stateNum);
  });

  it('look up all next possible states on workflow', async () => {
    const workflow = await createWorkflow(app, { baseNodeId: org.id });
    const toState = await addState(app, { workflowId: workflow.id });

    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    await app.graphql.mutate(
      gql`
        mutation attachSecurityGroup($input: GroupStateInput!) {
          attachSecurityGroup(input: $input)
        }
      `,
      {
        input: {
          groupState: {
            stateId: workflow.startingState.id,
            securityGroupId: sg.id,
          },
        },
      }
    );

    await login(app, {
      email,
      password,
    });

    await app.graphql.mutate(
      gql`
        mutation addPossibleState($input: PossibleStateInput!) {
          addPossibleState(input: $input)
        }
      `,
      {
        input: {
          state: {
            fromStateId: workflow.startingState.id,
            toStateId: toState.id,
          },
        },
      }
    );

    const result = await app.graphql.query(
      gql`
        query nextStates($id: ID!) {
          nextStates(id: $id) {
            items {
              id
              value
            }
          }
        }
      `,
      {
        id: workflow.startingState.id,
      }
    );

    expect(result.nextStates.items.length).toBeGreaterThanOrEqual(1);
  });

  it('attach securitygroup to state', async () => {
    await login(app, {
      email: email,
      password: password,
    });

    const workflow = await createWorkflow(app, { baseNodeId: org.id });

    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    const result = await app.graphql.mutate(
      gql`
        mutation attachSecurityGroup($input: GroupStateInput!) {
          attachSecurityGroup(input: $input)
        }
      `,
      {
        input: {
          groupState: {
            stateId: workflow.startingState.id,
            securityGroupId: sg.id,
          },
        },
      }
    );

    const actual: boolean | undefined = result.attachSecurityGroup;
    expect(actual).toBeTruthy();
  });

  it('remove security group from state', async () => {
    await login(app, {
      email: email,
      password: password,
    });

    const workflow = await createWorkflow(app, { baseNodeId: org.id });

    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    await app.graphql.mutate(
      gql`
        mutation attachSecurityGroup($input: GroupStateInput!) {
          attachSecurityGroup(input: $input)
        }
      `,
      {
        input: {
          groupState: {
            stateId: workflow.startingState.id,
            securityGroupId: sg.id,
          },
        },
      }
    );

    const result = await app.graphql.mutate(
      gql`
        mutation removeSecurityGroup($input: GroupStateInput!) {
          removeSecurityGroup(input: $input)
        }
      `,
      {
        input: {
          groupState: {
            stateId: workflow.startingState.id,
            securityGroupId: sg.id,
          },
        },
      }
    );

    const actual: boolean | undefined = result.removeSecurityGroup;
    expect(actual).toBeTruthy();
  });

  it('attach notification group to state', async () => {
    await login(app, {
      email: email,
      password: password,
    });

    const workflow = await createWorkflow(app, { baseNodeId: org.id });

    const result = await app.graphql.mutate(
      gql`
        mutation attachNotificationGroup($input: GroupStateInput!) {
          attachNotificationGroup(input: $input)
        }
      `,
      {
        input: {
          groupState: {
            stateId: workflow.startingState.id,
            securityGroupId: sg.id,
          },
        },
      }
    );

    const actual: boolean | undefined = result.attachNotificationGroup;
    expect(actual).toBeTruthy();
  });

  it('remove notification group to state', async () => {
    await login(app, {
      email: email,
      password: password,
    });

    const workflow = await createWorkflow(app, { baseNodeId: org.id });

    await app.graphql.mutate(
      gql`
        mutation attachNotificationGroup($input: GroupStateInput!) {
          attachNotificationGroup(input: $input)
        }
      `,
      {
        input: {
          groupState: {
            stateId: workflow.startingState.id,
            securityGroupId: sg.id,
          },
        },
      }
    );

    const result = await app.graphql.mutate(
      gql`
        mutation removeNotificationGroup($input: GroupStateInput!) {
          removeNotificationGroup(input: $input)
        }
      `,
      {
        input: {
          groupState: {
            stateId: workflow.startingState.id,
            securityGroupId: sg.id,
          },
        },
      }
    );

    const actual: boolean | undefined = result.removeNotificationGroup;
    expect(actual).toBeTruthy();
  });

  it('change current statee in workflow', async () => {
    await login(app, { email, password });
    const workflow = await createWorkflow(app, { baseNodeId: org.id });
    const toState = await addState(app, { workflowId: workflow.id });

    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    await app.graphql.mutate(
      gql`
        mutation attachSecurityGroup($input: GroupStateInput!) {
          attachSecurityGroup(input: $input)
        }
      `,
      {
        input: {
          groupState: {
            stateId: workflow.startingState.id,
            securityGroupId: sg.id,
          },
        },
      }
    );

    await login(app, { email, password });

    await app.graphql.mutate(
      gql`
        mutation addPossibleState($input: PossibleStateInput!) {
          addPossibleState(input: $input)
        }
      `,
      {
        input: {
          state: {
            fromStateId: workflow.startingState.id,
            toStateId: toState.id,
          },
        },
      }
    );

    const result = await app.graphql.mutate(
      gql`
        mutation changeCurrentState($input: ChangeCurrentStateInput!) {
          changeCurrentState(input: $input)
        }
      `,
      {
        input: {
          state: {
            newStateId: toState.id,
            workflowId: workflow.id,
          },
        },
      }
    );

    const actual: boolean | undefined = result.changeCurrentState;
    expect(actual).toBeTruthy();
  });

  it('add possible state to a state', async () => {
    await login(app, {
      email: email,
      password: password,
    });

    const workflow = await createWorkflow(app, { baseNodeId: org.id });
    const toState = await addState(app, { workflowId: workflow.id });

    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    await app.graphql.mutate(
      gql`
        mutation attachSecurityGroup($input: GroupStateInput!) {
          attachSecurityGroup(input: $input)
        }
      `,
      {
        input: {
          groupState: {
            stateId: workflow.startingState.id,
            securityGroupId: sg.id,
          },
        },
      }
    );

    await login(app, {
      email,
      password,
    });

    const result = await app.graphql.mutate(
      gql`
        mutation addPossibleState($input: PossibleStateInput!) {
          addPossibleState(input: $input)
        }
      `,
      {
        input: {
          state: {
            fromStateId: workflow.startingState.id,
            toStateId: toState.id,
          },
        },
      }
    );

    const actual: boolean | undefined = result.addPossibleState;
    expect(actual).toBeTruthy();
  });

  it('remove possible state to a state', async () => {
    await login(app, {
      email,
      password,
    });

    const workflow = await createWorkflow(app, { baseNodeId: org.id });
    const toState = await addState(app, { workflowId: workflow.id });

    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    await app.graphql.mutate(
      gql`
        mutation attachSecurityGroup($input: GroupStateInput!) {
          attachSecurityGroup(input: $input)
        }
      `,
      {
        input: {
          groupState: {
            stateId: workflow.startingState.id,
            securityGroupId: sg.id,
          },
        },
      }
    );

    await login(app, {
      email,
      password,
    });

    await app.graphql.mutate(
      gql`
        mutation addPossibleState($input: PossibleStateInput!) {
          addPossibleState(input: $input)
        }
      `,
      {
        input: {
          state: {
            fromStateId: workflow.startingState.id,
            toStateId: toState.id,
          },
        },
      }
    );

    const result = await app.graphql.mutate(
      gql`
        mutation removePossibleState($input: PossibleStateInput!) {
          removePossibleState(input: $input)
        }
      `,
      {
        input: {
          state: {
            fromStateId: workflow.startingState.id,
            toStateId: toState.id,
          },
        },
      }
    );

    const actual: boolean | undefined = result.removePossibleState;
    expect(actual).toBeTruthy();
  });

  it('add a required field to a state', async () => {
    await login(app, {
      email: email,
      password: password,
    });

    const workflow = await createWorkflow(app, { baseNodeId: org.id });

    const result = await app.graphql.mutate(
      gql`
        mutation addRequiredField($input: RequiredFieldInput!) {
          addRequiredField(input: $input)
        }
      `,
      {
        input: {
          field: {
            stateId: workflow.startingState.id,
            propertyName: 'name',
          },
        },
      }
    );

    const actual: boolean | undefined = result.addRequiredField;
    expect(actual).toBeTruthy();
  });

  it('remove a required field from state', async () => {
    await login(app, {
      email: email,
      password: password,
    });

    const workflow = await createWorkflow(app, { baseNodeId: org.id });

    await app.graphql.mutate(
      gql`
        mutation addRequiredField($input: RequiredFieldInput!) {
          addRequiredField(input: $input)
        }
      `,
      {
        input: {
          field: {
            stateId: workflow.startingState.id,
            propertyName: 'name',
          },
        },
      }
    );

    const result = await app.graphql.mutate(
      gql`
        mutation removeRequiredField($input: RequiredFieldInput!) {
          removeRequiredField(input: $input)
        }
      `,
      {
        input: {
          field: {
            stateId: workflow.startingState.id,
            propertyName: 'name',
          },
        },
      }
    );

    const actual: boolean | undefined = result.removeRequiredField;
    expect(actual).toBeTruthy();
  });

  it('list required fields in state', async () => {
    await login(app, {
      email: email,
      password: password,
    });

    const workflow = await createWorkflow(app, { baseNodeId: org.id });

    await app.graphql.mutate(
      gql`
        mutation addRequiredField($input: RequiredFieldInput!) {
          addRequiredField(input: $input)
        }
      `,
      {
        input: {
          field: {
            stateId: workflow.startingState.id,
            propertyName: 'name',
          },
        },
      }
    );

    const result = await app.graphql.query(
      gql`
        query listRequiredFields($id: ID!) {
          listRequiredFields(id: $id) {
            items {
              value
            }
          }
        }
      `,
      {
        id: workflow.startingState.id,
      }
    );

    // when baseNode is organization having only one field named 'name'.
    expect(result.listRequiredFields.items.length).toBeGreaterThanOrEqual(1);
  });
});
