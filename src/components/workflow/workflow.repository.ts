import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { generateId, ID, Session } from '../../common';
import { DatabaseService, matchSession } from '../../core';
import {
  AddState,
  ChangeCurrentState,
  CreateWorkflow,
  FieldObject,
  GroupState,
  PossibleState,
  RequiredField,
  State,
  UpdateState,
} from './dto';

@Injectable()
export class WorkflowRepository {
  constructor(private readonly db: DatabaseService) {}

  async createWorkflow(
    session: Session,
    input: CreateWorkflow,
    workflowId: ID
  ) {
    return await this.db
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
            id: await generateId(),
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
            value: input.startingStateName,
          }),
        ],
      ])
      .return({
        workflow: [{ id: 'id' }, { stateIdentifier: 'stateIdentifier' }],
        state: [{ id: 'startingStateId' }, { value: 'startingStateValue' }],
      })
      .first();
  }

  async deleteWorkflow(session: Session, workflowId: ID) {
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
  }

  async addState(session: Session, input: AddState, stateId: ID) {
    return await this.db
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
  }

  async getState(session: Session, input: UpdateState) {
    return await this.db
      .query()
      .match([
        [
          ...matchSession(session),
          relation('in', '', 'member'),
          node('sg', 'SecurityGroup'),
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
      .asResult<{ stateIdentifier: string }>()
      .first();
  }

  async validateState(
    session: Session,
    input: UpdateState,
    stateIdentifier: string
  ) {
    return await this.db
      .query()
      .match([
        [
          ...matchSession(session),
          relation('in', '', 'member'),
          node('sg', 'SecurityGroup'),
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
          relation('out', '', `${stateIdentifier}`, {
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
  }

  async updateState(input: UpdateState) {
    return await this.db
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
  }

  async deleteState(session: Session, stateId: ID) {
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
  }

  async listStates(session: Session, baseNodeId: ID) {
    return (await this.db
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
  }

  async listNextStates(session: Session, stateId: ID) {
    return (await this.db
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
  }

  async attachSecurityGroup(session: Session, input: GroupState) {
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
          node('sg', 'SecurityGroup', {
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
          node('sg'),
        ],
      ])
      .first();
  }

  async removeSecurityGroup(session: Session, input: GroupState) {
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
          node('sg', 'SecurityGroup', {
            id: input.securityGroupId,
          }),
        ],
        [
          node('state', 'State', {
            id: input.stateId,
          }),
          relation('out', 'rel', 'securityGroup'),
          node('sg'),
        ],
      ])
      .detachDelete('rel')
      .first();
  }

  async attachNotificationGroup(session: Session, input: GroupState) {
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
          node('sg', 'SecurityGroup', {
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
          node('sg'),
        ],
      ])
      .first();
  }
  async removeNotificationGroup(session: Session, input: GroupState) {
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
          node('sg', 'SecurityGroup', {
            id: input.securityGroupId,
          }),
        ],
        [
          node('state', 'State', {
            id: input.stateId,
          }),
          relation('out', 'rel', 'notification'),
          node('sg'),
        ],
      ])
      .detachDelete('rel')
      .first();
  }

  async getCurrentState(session: Session, input: ChangeCurrentState) {
    return await this.db
      .query()
      .match([
        [
          ...matchSession(session),
          relation('in', '', 'member'),
          node('sg', 'SecurityGroup'),
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
      .asResult<{ stateIdentifier: string }>()
      .first();
  }

  async validateNextState(
    session: Session,
    input: ChangeCurrentState,
    stateIdentifier: string
  ) {
    return await this.db
      .query()
      .match([
        [
          ...matchSession(session),
          relation('in', '', 'member'),
          node('sg', 'SecurityGroup'),
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
          relation('out', '', `${stateIdentifier}`),
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
  }

  async changeCurrentState(
    session: Session,
    possibleState: Dictionary<any> | undefined,
    stateIdentifier: string
  ) {
    await this.db
      .query()
      .match([
        [
          ...matchSession(session),
          relation('in', '', 'member'),
          node('sg', 'SecurityGroup'),
          relation('out', '', 'permission'),
          node('permission', 'Permission', {
            write: true,
            read: true,
          }),
          relation('out', '', 'baseNode'),
          node('baseNode', 'BaseNode'),
          relation('out', 'oldRel', `${stateIdentifier}`),
          node('currentState', 'CurrentState:Property', {
            value: possibleState?.value,
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
          relation('out', '', `${stateIdentifier}`, {
            active: true,
          }),
          node('newCurrentState', 'CurrentState:Property', {
            value: possibleState?.newValue,
          }),
        ],
      ])
      .run();
  }

  async addPossibleState(session: Session, input: PossibleState) {
    return await this.db
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
  }

  async removePossibleState(session: Session, input: PossibleState) {
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
  }

  async getField(session: Session, input: RequiredField) {
    return await this.db
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
  }

  async updateField(session: Session, input: RequiredField) {
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
  }

  async listRequiredFields(session: Session, stateId: ID) {
    return (await this.db
      .query()
      .match([
        [
          ...matchSession(session),
          relation('in', '', 'member'),
          node('sg', 'SecurityGroup'),
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
  }
  async removeRequiredField(session: Session, input: RequiredField) {
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
  }
}
