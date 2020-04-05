/* eslint-disable */
import { Injectable, NotImplementedException, NotFoundException } from '@nestjs/common';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { CreateWorkflow, Workflow, AddState, State, UpdateState, StateListOutput, GroupState, ChangeState, CurrentState, PossibleState, FieldState, CommentState } from './dto';
import { Logger, ILogger, DatabaseService } from '../../core';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly db: DatabaseService,
    @Logger('workflow.service') private readonly logger: ILogger
  ) {}

  async readWorkflow(session: ISession, workflowId: string): Promise<Workflow> {
    const query = `
      MATCH
        (token:Token {
          active: true,
          value: $token
        })
          <-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId,
          owningOrgId: $owningOrgId
        }),
        (workflow:Workflow {active: true, id: $workflowId})
      RETURN
        workflow.id as id,
        workflow.createdAt as createdAt
    `;
    const result = await this.db
      .query()
      .raw(query,{
        token: session.token,
        requestingUserId: session.userId,
        owningOrgId: session.owningOrgId,
        workflowId
      })
      .first();

    if ( !result ) {
      throw new NotFoundException('Could not find workflow');
    }

    return {
      id: result.id,
      createdAt: result.createdAt
    }
  }
  // only 1 workflow per base node, only 1 base node per workflow. WF doesn't need a name, just id
  // when the workflow node is created, the :CurrentState node is created.
  async createWorkflow(session: ISession, { baseNodeId, startingStateName }: CreateWorkflow) : Promise<Workflow> {
    try {
      // Create :Workflow node
      const workflowId = generate();
      await this.db.createNode({
        session,
        type: Workflow.classType,
        input: {
          id: workflowId,
        },
        acls: {},
        aclEditProp: 'canCreateWorkflow'
      });

      // create :CurrentState node
      const currentStateId = generate();
      await this.db.createNode({
        session,
        type: CurrentState.classType,
        input: {
          id: currentStateId,
        },
        acls: {},
        aclEditProp: 'canCreateCurrentState'
      });

      // create :State node
      const stateId = generate();
      await this.db.createNode({
        session,
        type: State.classType,
        input: {
          id: stateId,
          stateName: startingStateName,
        },
        acls: {},
        aclEditProp: 'canCreateState'
      });

      const query = `
        MATCH
          (baseNode {active: true, id: $baseNodeId}),
          (workflow:Workflow {active: true, id: $workflowId}),
          (currentState:CurrentState {active: true, id: $currentStateId}),
          (state:State {active: true, id: $stateId})
        CREATE
          (baseNode)-[:workflow {active: true}]->(workflow),
          (workflow)-[:currentState {active: true, enteredOn: datetime()}]->(currentState),
          (workflow)-[:possibleState {active: true, startingState: true}]->(state)
      `;

      await this.db
        .query()
        .raw(query, {
          baseNodeId,
          workflowId,
          currentStateId,
          stateId
        })
        .first();

      return await this.readWorkflow(session, workflowId);

    } catch (e) {
      this.logger.warning('Failed to create workflow', {
        exception: e
      })

      throw new Error('Could not create workflow');
    }
  };

  async deleteWorkflow(_session: ISession, _workflowId: string) : Promise<void> {
    throw new NotImplementedException();
  };

  // the stateName is stored in the (:State)'s 'value' property (consistent with (:Property)s on (:BaseNode)s )
  // addStateToWorkflow
  async addState(_session: ISession, _input: AddState): Promise<State> {
    throw new NotImplementedException();
  };

  // updateStateName
  async updateState(_session: ISession, _input: UpdateState): Promise<State> {
    throw new NotImplementedException();
  };

  // deleteStateFromWorkflow
  async deleteState(_session: ISession, _stateId: string) : Promise<void> {
    throw new NotImplementedException();
  };

  // we don't need to have a list workflow function when we have a list state function that takes the baseNodeId
  // listAllStatesOnWorkflow
  async listStates(_session: ISession, _baseNodeId: string): Promise<StateListOutput>{
    throw new NotImplementedException();
  };

  // this will be used to get the next possible states of any state, including the current state
  // listNextPossibleStates
  async listNextStates(_session: ISession, _stateId: string): Promise<StateListOutput>{
    throw new NotImplementedException();
  };

  // attachSecurityGroupToState
  async attachSecurityGroup(_session: ISession, _input: GroupState): Promise<void>{
    throw new NotImplementedException();
  };

  // removeSecurityGroupFromState
  async removeSecurityGroup(_session: ISession, _input: GroupState): Promise<void>{
    throw new NotImplementedException();
  }

  // we are using security groups as notification groups for now
  // attachNotificationGroupToState
  async attachNotificationGroup(_session: ISession, _input: GroupState): Promise<void>{
    throw new NotImplementedException();
  }

  // removeNotificationGroupFromState
  async removeNotificationGroup(_session: ISession, _input: GroupState): Promise<void>{
    throw new NotImplementedException();
  }

  // changeCurrentStateInWorkflow
  async changeCurrentState(_session: ISession, _input: ChangeState): Promise<CommentState>{
    throw new NotImplementedException();
  }

  // creates a relationship from one state to another
  // later we can create an abstracted function that creates and attaches a state to another state
  // addPossibleStateToState
  async addPossibleState(_session: ISession, _input: PossibleState): Promise<State>{
    throw new NotImplementedException();
  }

  // removePossibleStateFromState
  async removePossibleState(_session: ISession, _input: PossibleState): Promise<void>{
    throw new NotImplementedException();
  }

  // there will be more than one required field relationship between a state node and a base node.
  // this is so each required field can be queried without inspecting the property name in app code.
  // addRequiredFieldToState
  async addField(_session: ISession, _input: FieldState): Promise<void>{
    throw new NotImplementedException();
  }

  // listAllRequiredFieldsInAState
  async listFields(_session: ISession, _stateId: string): Promise<void>{
    throw new NotImplementedException();
  }

  // removeRequiredFieldFromState
  async removeField(_session: ISession, _input: FieldState): Promise<void>{
    throw new NotImplementedException();
  }
}
