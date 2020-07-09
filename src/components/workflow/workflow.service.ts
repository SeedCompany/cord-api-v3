/* eslint-disable */
import {
  Injectable,
  InternalServerErrorException as ServerException,
  NotFoundException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { generate } from 'shortid';
import { node, relation } from 'cypher-query-builder';
import { ISession } from '../../common';
import {
  CreateWorkflow,
  Workflow,
  AddState,
  State,
  UpdateState,
  StateListOutput,
  GroupState,
  ChangeCurrentState,
  PossibleState,
  RequiredField,
  RequiredFieldListOutput,
  FieldObject,
} from './dto';
import { Logger, ILogger, DatabaseService, matchSession } from '../../core';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly db: DatabaseService,
    @Logger('workflow.service') private readonly logger: ILogger
  ) {}

  // multiple workflows will be able to be created per one base node.
  async createWorkflow(
    session: ISession,
    input: CreateWorkflow
  ): Promise<Workflow> {
    try {
      const workflowId = generate();

      const result = await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token,
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('user', 'User'),
            relation('in', '', 'admin', {
              active: true,
            }),
            node('baseNode', 'BaseNode', {
              id: input.baseNodeId,
            }),
          ],
        ])
        .merge([
          [
            node('baseNode'),
            relation('out', '', 'workflow', {
              active: true,
            }),
            node('workflow', 'Workflow', {
              id: workflowId,
              stateIdentifier: input.stateIdentifier,
            }),
          ],
        ])
        .merge([
          [
            node('workflow'),
            relation('out', '', 'possibleState', {
              active: true,
              startingState: true,
            }),
            node('state', 'State', {
              id: generate(),
              value: input.startingStateName,
            }),
          ],
        ])
        .merge([
          [
            node('baseNode'),
            relation('out', '', `${input.stateIdentifier}`, {
              active: true,
            }),
            node('currentState', 'CurrentState:Property', {
              active: true,
              value: input.startingStateName,
            }),
          ],
        ])
        .return({
          workflow: [{ id: 'id' }, { stateIdentifier: 'stateIdentifier' }],
          state: [{ id: 'startingStateId' }, { value: 'startingStateValue' }],
        })
        .first();

      if (!result) {
        throw new UnauthorizedException('could not create a workflow');
      }

      return {
        id: result.id,
        stateIdentifier: result.stateIdentifier,
        startingState: {
          id: result.startingStateId,
          value: result.startingStateValue,
        },
      };
    } catch (e) {
      this.logger.warning('Failed to create workflow', {
        exception: e,
      });

      throw new InternalServerErrorException('Could not create workflow');
    }
  }

  async deleteWorkflow(session: ISession, workflowId: string): Promise<void> {
    try {
      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token,
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('user', 'User'),
            relation('in', '', 'admin', {
              active: true,
            }),
            node('baseNode'),
            relation('out', '', 'workflow', {
              active: true,
            }),
            node('workflow', 'Workflow', {
              id: workflowId,
            }),
          ],
        ])
        .detachDelete('workflow')
        .run();
    } catch (e) {
      this.logger.warning('Failed to delete workflow', {
        exception: e,
      });

      throw new ServerException('Failed to delete workflow');
    }
  }

  // the stateName is stored in the (:State)'s 'value' property (consistent with (:Property)s on (:BaseNode)s )  // addStateToWorkflow
  async addState(session: ISession, input: AddState): Promise<State> {
    try {
      const stateId = generate();
      const result = await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token,
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('user'),
            relation('in', '', 'admin', {
              active: true,
            }),
            node('baseNode'),
            relation('out', '', 'workflow', {
              active: true,
            }),
            node('workflow', 'Workflow', {
              id: input.workflowId,
            }),
          ],
        ])
        .merge([
          [
            node('workflow'),
            relation('out', '', 'possibleState', {
              active: true,
              startingState: false,
            }),
            node('state', 'State', {
              id: stateId,
              value: input.stateName,
            }),
          ],
        ])
        .return({
          state: [{ id: 'id' }, { value: 'value' }],
        })
        .first();

      if (!result) {
        throw new NotFoundException('could not create a state');
      }

      return {
        id: result.id,
        value: result.value,
      };
    } catch (e) {
      this.logger.warning('could not add new state to a workflow', {
        exception: e,
      });
      throw new ServerException('could not add new state to a workflow');
    }
  }

  // updateStateName
  async updateState(session: ISession, input: UpdateState): Promise<State> {
    try {
      // get current state and workflow
      const workflow = await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'member'),
            node('securityGroup', 'SecurityGroup'),
            relation('out', '', 'permission'),
            node('permission', 'Permission', {
              read: true,
              write: true,
            }),
            relation('out', '', 'baseNode'),
            node('baseNode', 'BaseNode'),
            relation('out', '', 'workflow', {
              active: true,
            }),
            node('workflow', 'Workflow', {
              id: input.workflowId,
            }),
          ],
        ])
        .return({
          workflow: [{ stateIdentifier: 'stateIdentifier' }],
        })
        .first();

      if (!workflow) {
        throw new NotFoundException('could not find workflow');
      }

      // validate the new state is a legal nextPossibleState on the current state
      const possibleState = await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'member'),
            node('securityGroup', 'SecurityGroup'),
            relation('out', '', 'permission'),
            node('permission', 'Permission', {
              read: true,
              write: true,
            }),
            relation('out', '', 'baseNode'),
            node('baseNode', 'BaseNode'),
            relation('out', '', 'workflow', {
              active: true,
            }),
            node('workflow', 'Workflow', {
              id: input.workflowId,
            }),
          ],
          [
            node('baseNode'),
            relation('out', '', `${workflow.stateIdentifier}`, {
              active: true,
            }),
            node('currentState', 'CurrentState'),
          ],
        ])
        .with(['currentState', { 'currentState.value': 'currentStateValue' }])
        .match([
          [
            node('state', 'State {value: currentStateValue}'),
            relation('out', '', 'nextPossibleState', {
              active: true,
            }),
            node('newState', 'State', {
              id: input.stateId,
            }),
          ],
        ])
        .return({
          state: 'state',
        })
        .first();

      if (!possibleState) {
        throw new NotFoundException(
          'new state provided is not a nextpossiblstate of current state'
        );
      }

      const result = await this.db
        .query()
        .match([
          [
            node('state', 'State', {
              id: input.stateId,
            }),
          ],
        ])
        .set({
          values: {
            'state.value': input.stateName,
          },
        })
        .return({
          state: [{ id: 'id' }, { value: 'value' }],
        })
        .first();

      if (!result) {
        throw new NotFoundException('Could not update state');
      }

      return {
        id: result.id,
        value: result.value,
      };
    } catch (e) {
      this.logger.warning('could not update state', {
        exception: e,
      });
      throw new ServerException('could not update state');
    }
  }

  // deleteStateFromWorkflow
  async deleteState(session: ISession, stateId: string): Promise<void> {
    try {
      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token,
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('user'),
            relation('in', '', 'admin', {
              active: true,
            }),
            node('baseNode'),
            relation('out', '', 'workflow', {
              active: true,
            }),
            node('workflow'),
            relation('out', '', 'possibleState', {
              active: true,
            }),
            node('state', 'State', {
              id: stateId,
            }),
          ],
        ])
        .detachDelete('state')
        .first();
    } catch (e) {
      this.logger.warning('Failed to delete state', {
        exception: e,
      });

      throw new ServerException('Failed to delete state');
    }
  }

  // we don't need to have a list workflow function when we have a list state function that takes the baseNodeId // listAllStatesOnWorkflow
  async listStates(
    session: ISession,
    baseNodeId: string
  ): Promise<StateListOutput> {
    try {
      const result = (await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token,
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('user'),
            relation('in', '', 'admin', {
              active: true,
            }),
            node('baseNode', 'BaseNode', {
              id: baseNodeId,
            }),
            relation('out', '', 'workflow', {
              active: true,
            }),
            node('workflow'),
            relation('out', '', 'possibleState', {
              active: true,
            }),
            node('state'),
          ],
        ])
        .return({
          state: [{ id: 'id' }, { value: 'value' }],
        })
        .run()) as State[];

      return { items: result.filter((item) => item.id && item.value) };
    } catch (e) {
      this.logger.warning('Failed to delete state', {
        exception: e,
      });

      throw new ServerException('Failed to delete state');
    }
  }

  // this will be used to get the next possible states of any state, including the current state  // listNextPossibleStates
  async listNextStates(
    session: ISession,
    stateId: string
  ): Promise<StateListOutput> {
    try {
      // WIP, not sure how to check session in this function
      const result = (await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'admin', {
              active: true,
            }),
            node('baseNode'),
            relation('out', '', 'workflow', {
              active: true,
            }),
            node('workflow'),
            relation('out', '', 'possibleState', {
              active: true,
            }),
            node('state', 'State', {
              id: stateId,
            }),
            relation('out', '', 'nextPossibleState', {
              active: true,
            }),
            node('nextState'),
          ],
        ])
        .return({
          nextState: [{ id: 'id' }, { value: 'value' }],
        })
        .run()) as State[];

      return { items: result.filter((item) => item.id && item.value) };
    } catch (e) {
      this.logger.warning('Failed to delete state', {
        exception: e,
      });

      throw new ServerException('Failed to delete state');
    }
  }

  // attachSecurityGroupToState
  async attachSecurityGroup(
    session: ISession,
    input: GroupState
  ): Promise<void> {
    try {
      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token,
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('requestingUser', 'User', {
              id: session.userId,
            }),
            relation('in', '', 'member', {
              admin: true,
            }),
            node('securityGroup', 'SecurityGroup', {
              id: input.securityGroupId,
            }),
          ],
          [
            node('state', 'State', {
              id: input.stateId,
            }),
          ],
        ])
        .merge([
          [
            node('state'),
            relation('out', '', 'securityGroup', {
              active: true,
            }),
            node('securityGroup'),
          ],
        ])
        .first();
    } catch (e) {
      this.logger.warning('could not attach security group to state', {
        exception: e,
      });
      throw new ServerException('could not attach security group to state');
    }
  }

  // removeSecurityGroupFromState
  async removeSecurityGroup(
    session: ISession,
    input: GroupState
  ): Promise<void> {
    try {
      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token,
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('requestingUser', 'User', {
              id: session.userId,
            }),
            relation('in', '', 'member', {
              admin: true,
            }),
            node('securityGroup', 'SecurityGroup', {
              id: input.securityGroupId,
            }),
          ],
          [
            node('state', 'State', {
              id: input.stateId,
            }),
            relation('out', 'rel', 'securityGroup'),
            node('securityGroup'),
          ],
        ])
        .detachDelete('rel')
        .first();
    } catch (e) {
      this.logger.warning('could not remove security group from state', {
        exception: e,
      });
      throw new ServerException('could not remove security group from state');
    }
  }

  // we are using security groups as notification groups for now
  // attachNotificationGroupToState
  async attachNotificationGroup(
    session: ISession,
    input: GroupState
  ): Promise<void> {
    try {
      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token,
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('requestingUser', 'User', {
              id: session.userId,
            }),
            relation('in', '', 'member'),
            node('securityGroup', 'SecurityGroup', {
              id: input.securityGroupId,
            }),
          ],
          [
            node('state', 'State', {
              id: input.stateId,
            }),
          ],
        ])
        .merge([
          [
            node('state'),
            relation('out', '', 'notification', {
              active: true,
              onEnter: true,
            }),
            node('securityGroup'),
          ],
        ])
        .first();
    } catch (e) {
      this.logger.warning('could not attach security group to state', {
        exception: e,
      });
      throw new ServerException('could not attach security group to state');
    }
  }

  // removeNotificationGroupFromState
  async removeNotificationGroup(
    session: ISession,
    input: GroupState
  ): Promise<void> {
    try {
      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token,
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('requestingUser', 'User', {
              id: session.userId,
            }),
            relation('in', '', 'member'),
            node('securityGroup', 'SecurityGroup', {
              id: input.securityGroupId,
            }),
          ],
          [
            node('state', 'State', {
              id: input.stateId,
            }),
            relation('out', 'rel', 'notification'),
            node('securityGroup'),
          ],
        ])
        .detachDelete('rel')
        .first();
    } catch (e) {
      this.logger.warning('could not remove security group from state', {
        exception: e,
      });
      throw new ServerException('could not remove security group from state');
    }
  }

  // changeCurrentStateInWorkflow
  async changeCurrentState(
    session: ISession,
    input: ChangeCurrentState
  ): Promise<void> {
    try {
      // get current state and workflow
      const workflow = await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'member'),
            node('securityGroup', 'SecurityGroup'),
            relation('out', '', 'permission'),
            node('permission', 'Permission', {
              read: true,
            }),
            relation('out', '', 'baseNode'),
            node('baseNode', 'BaseNode'),
            relation('out', '', 'workflow', {
              active: true,
            }),
            node('workflow', 'Workflow', {
              id: input.workflowId,
            }),
          ],
        ])
        .return({
          workflow: [{ stateIdentifier: 'stateIdentifier' }],
        })
        .first();

      if (!workflow) {
        throw new NotFoundException('could not find workflow');
      }

      // validate the new state is a legal nextPossibleState on the current state
      const possibleState = await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'member'),
            node('securityGroup', 'SecurityGroup'),
            relation('out', '', 'permission'),
            node('permission', 'Permission', {
              read: true,
            }),
            relation('out', '', 'baseNode'),
            node('baseNode', 'BaseNode'),
            relation('out', '', 'workflow', {
              active: true,
            }),
            node('workflow', 'Workflow', {
              id: input.workflowId,
            }),
          ],
          [
            node('baseNode'),
            relation('out', '', `${workflow.stateIdentifier}`),
            node('currentState', 'CurrentState:Property'),
          ],
        ])
        .with(['currentState', { 'currentState.value': 'currentStateValue' }])
        .match([
          [
            node('state', 'State {value: currentStateValue}'),
            relation('out', '', 'nextPossibleState', {
              active: true,
            }),
            node('newState', 'State', {
              id: input.newStateId,
            }),
          ],
        ])
        .return({
          state: [{ value: 'value' }],
          newState: [{ value: 'newValue' }],
        })
        .first();

      if (!possibleState) {
        throw new NotFoundException(
          'new state provided is not a nextpossiblstate of current state'
        );
      }

      await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'member'),
            node('securityGroup', 'SecurityGroup'),
            relation('out', '', 'permission'),
            node('permission', 'Permission', {
              write: true,
              read: true,
            }),
            relation('out', '', 'baseNode'),
            node('baseNode', 'BaseNode'),
            relation('out', 'oldRel', `${workflow.stateIdentifier}`),
            node('currentState', 'CurrentState:Property', {
              active: true,
              value: possibleState.value,
            }),
          ],
        ])
        .set({
          values: {
            'oldRel.active': false,
          },
        })
        .merge([
          [
            node('baseNode'),
            relation('out', '', `${workflow.stateIdentifier}`, {
              active: true,
            }),
            node('newCurrentState', 'CurrentState:Property', {
              active: true,
              value: possibleState.newValue,
            }),
          ],
        ])
        .run();
    } catch (e) {
      this.logger.warning('could not change current state', {
        exception: e,
      });
      throw new ServerException('could not change current state');
    }
  }

  // creates a relationship from one state to another
  // later we can create an abstracted function that creates and attaches a state to another state
  // addPossibleStateToState
  async addPossibleState(
    session: ISession,
    input: PossibleState
  ): Promise<void> {
    try {
      const result = await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'admin', {
              active: true,
            }),
            node('baseNode', 'BaseNode'),
            relation('out', '', 'workflow', {
              active: true,
            }),
            node('workflow', 'Workflow'),
            relation('out', '', 'possibleState', {
              active: true,
            }),
            node('fromState', 'State', {
              id: input.fromStateId,
            }),
          ],
          [
            node('workflow'),
            relation('out', '', 'possibleState', {
              active: true,
            }),
            node('toState', 'State', {
              id: input.toStateId,
            }),
          ],
        ])
        .merge([
          node('fromState'),
          relation('out', '', 'nextPossibleState', {
            active: true,
          }),
          node('toState'),
        ])
        .return({
          toState: [{ id: 'id' }],
        })
        .first();

      if (!result) {
        throw new NotFoundException('could not make correct query result');
      }
    } catch (e) {
      this.logger.warning('failed to add possible state to state', {
        exception: e,
      });
      throw new ServerException('failed to add possible state to state');
    }
  }

  // removePossibleStateFromState
  async removePossibleState(
    session: ISession,
    input: PossibleState
  ): Promise<void> {
    try {
      await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'admin', {
              active: true,
            }),
            node('baseNode', 'BaseNode'),
            relation('out', '', 'workflow', {
              active: true,
            }),
            node('workflow'),
            relation('out', '', 'possibleState', {
              active: true,
            }),
            node('fromState', 'State', {
              id: input.fromStateId,
            }),
            relation('out', 'rel', 'nextPossibleState', {
              active: true,
            }),
            node('toState', 'State', {
              id: input.toStateId,
            }),
          ],
        ])
        .detachDelete('rel')
        .run();
    } catch (e) {
      this.logger.warning('failed to remove possible state', {
        exception: e,
      });
      throw new ServerException('failed to remove possible state');
    }
  }

  // there will be more than one required field relationship between a state node and a base node.
  // this is so each required field can be queried without inspecting the property name in app code.
  // addRequiredFieldToState
  async addRequiredField(
    session: ISession,
    input: RequiredField
  ): Promise<void> {
    try {
      const field = await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token,
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('user'),
            relation('in', '', 'admin', {
              active: true,
            }),
            node('baseNode'),
            relation('out', '', `${input.propertyName}`),
            node('property'),
          ],
        ])
        .return({
          property: 'property',
        })
        .first();

      if (!field) {
        throw new NotFoundException('could not find such field existing.');
      }

      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token,
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('user'),
            relation('in', '', 'admin', {
              active: true,
            }),
            node('baseNode'),
          ],
          [
            node('state', 'State', {
              id: input.stateId,
            }),
          ],
        ])
        .merge([
          node('baseNode'),
          relation('in', '', 'requiredProperty', {
            value: input.propertyName,
          }),
          node('state'),
        ])
        .first();
    } catch (e) {
      this.logger.warning('could not add field to state', {
        exception: e,
      });
      throw new ServerException('could not add field to state');
    }
  }

  // listAllRequiredFieldsInAState
  async listRequiredFields(
    session: ISession,
    stateId: string
  ): Promise<RequiredFieldListOutput> {
    try {
      const result = (await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'member'),
            node('securityGroup', 'SecurityGroup'),
            relation('out', '', 'permission'),
            node('permission', 'Permission', {
              read: true,
            }),
            relation('out', '', 'baseNode'),
            node('baseNode', 'BaseNode'),
          ],
          [
            node('baseNode'),
            relation('in', 'rel', 'requiredProperty'),
            node('state', 'State', {
              id: stateId,
            }),
          ],
        ])
        .return({
          'rel.value': 'value',
        })
        .run()) as FieldObject[];

      return {
        items: result.filter((item) => item.value),
      };
    } catch (e) {
      this.logger.warning('could not list fields', {
        exception: e,
      });
      throw new ServerException('could not list fields');
    }
  }

  // removeRequiredFieldFromState
  async removeRequiredField(
    session: ISession,
    input: RequiredField
  ): Promise<void> {
    try {
      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token,
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('user'),
            relation('in', '', 'admin', {
              active: true,
            }),
            node('baseNode'),
            relation('in', 'rel', 'requiredProperty', {
              value: input.propertyName,
            }),
            node('state', 'State', {
              id: input.stateId,
            }),
          ],
        ])
        .detachDelete('rel')
        .run();
    } catch (e) {
      this.logger.warning('could not remove field from state', {
        exception: e,
      });
      throw new ServerException('could not remove field from state');
    }
  }
}
