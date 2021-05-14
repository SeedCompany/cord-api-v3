import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import {
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { DatabaseService, ILogger, Logger, matchSession } from '../../core';
import {
  AddState,
  ChangeCurrentState,
  CreateWorkflow,
  FieldObject,
  GroupState,
  PossibleState,
  RequiredField,
  RequiredFieldListOutput,
  State,
  StateListOutput,
  UpdateState,
  Workflow,
} from './dto';
import { WorkflowRepository } from './workflow.repository';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly db: DatabaseService,
    @Logger('workflow.service') private readonly logger: ILogger,
    private readonly repo: WorkflowRepository
  ) {}

  // multiple workflows will be able to be created per one base node.
  async createWorkflow(
    session: Session,
    input: CreateWorkflow
  ): Promise<Workflow> {
    try {
      const workflowId = await generateId();

      const result = await this.repo.createWorkflow(session, input, workflowId);

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
    } catch (exception) {
      this.logger.warning('Failed to create workflow', {
        exception,
      });

      throw new ServerException('Could not create workflow', exception);
    }
  }

  async deleteWorkflow(session: Session, workflowId: ID): Promise<void> {
    try {
      await this.repo.deleteWorkflow(session, workflowId);
    } catch (exception) {
      this.logger.warning('Failed to delete workflow', {
        exception,
      });

      throw new ServerException('Failed to delete workflow', exception);
    }
  }

  // the stateName is stored in the (:State)'s 'value' property (consistent with (:Property)s on (:BaseNode)s )  // addStateToWorkflow
  async addState(session: Session, input: AddState): Promise<State> {
    try {
      const stateId = await generateId();

      const result = await this.repo.addState(session, input, stateId);

      if (!result) {
        throw new NotFoundException('could not create a state');
      }

      return {
        id: result.id,
        value: result.value,
      };
    } catch (exception) {
      this.logger.warning('could not add new state to a workflow', {
        exception,
      });
      throw new ServerException(
        'could not add new state to a workflow',
        exception
      );
    }
  }

  // updateStateName
  async updateState(session: Session, input: UpdateState): Promise<State> {
    try {
      // get current state and workflow
      const workflow = await this.repo.getState(session, input);

      if (!workflow) {
        throw new NotFoundException(
          'could not find workflow',
          'state.workflowId'
        );
      }

      // validate the new state is a legal nextPossibleState on the current state
      const possibleState = await this.repo.validateState(
        session,
        input,
        workflow.stateIdentifier
      );

      if (!possibleState) {
        throw new NotFoundException(
          'new state provided is not a nextpossiblestate of current state'
        );
      }

      const result = await this.repo.updateState(input);

      if (!result) {
        throw new NotFoundException('Could not update state', 'state.stateId');
      }

      return {
        id: result.id,
        value: result.value,
      };
    } catch (exception) {
      this.logger.warning('could not update state', {
        exception,
      });
      throw new ServerException('could not update state', exception);
    }
  }

  // deleteStateFromWorkflow
  async deleteState(session: Session, stateId: ID): Promise<void> {
    try {
      await this.repo.deleteState(session, stateId);
    } catch (exception) {
      this.logger.warning('Failed to delete state', {
        exception,
      });

      throw new ServerException('Failed to delete state', exception);
    }
  }

  // we don't need to have a list workflow function when we have a list state function that takes the baseNodeId // listAllStatesOnWorkflow
  async listStates(session: Session, baseNodeId: ID): Promise<StateListOutput> {
    try {
      const result = await this.repo.listStates(session, baseNodeId);
      return { items: result.filter((item) => item.id && item.value) };
    } catch (exception) {
      this.logger.warning('Failed to delete state', {
        exception,
      });

      throw new ServerException('Failed to delete state', exception);
    }
  }

  // this will be used to get the next possible states of any state, including the current state  // listNextPossibleStates
  async listNextStates(
    session: Session,
    stateId: ID
  ): Promise<StateListOutput> {
    try {
      // WIP, not sure how to check session in this function
      const result = await this.repo.listNextStates(session, stateId);

      return { items: result.filter((item) => item.id && item.value) };
    } catch (exception) {
      this.logger.warning('Failed to delete state', {
        exception,
      });

      throw new ServerException('Failed to delete state', exception);
    }
  }

  // attachSecurityGroupToState
  async attachSecurityGroup(
    session: Session,
    input: GroupState
  ): Promise<void> {
    try {
      await this.repo.attachSecurityGroup(session, input);
    } catch (exception) {
      this.logger.warning('could not attach security group to state', {
        exception,
      });
      throw new ServerException(
        'could not attach security group to state',
        exception
      );
    }
  }

  // removeSecurityGroupFromState
  async removeSecurityGroup(
    session: Session,
    input: GroupState
  ): Promise<void> {
    try {
      await this.repo.removeSecurityGroup(session, input);
    } catch (exception) {
      this.logger.warning('could not remove security group from state', {
        exception,
      });
      throw new ServerException(
        'could not remove security group from state',
        exception
      );
    }
  }

  // we are using security groups as notification groups for now
  // attachNotificationGroupToState
  async attachNotificationGroup(
    session: Session,
    input: GroupState
  ): Promise<void> {
    try {
      await this.repo.attachNotificationGroup(session, input);
    } catch (exception) {
      this.logger.warning('could not attach security group to state', {
        exception,
      });
      throw new ServerException(
        'could not attach security group to state',
        exception
      );
    }
  }

  // removeNotificationGroupFromState
  async removeNotificationGroup(
    session: Session,
    input: GroupState
  ): Promise<void> {
    try {
      await this.repo.removeNotificationGroup(session, input);
    } catch (exception) {
      this.logger.warning('could not remove security group from state', {
        exception,
      });
      throw new ServerException(
        'could not remove security group from state',
        exception
      );
    }
  }

  // changeCurrentStateInWorkflow
  async changeCurrentState(
    session: Session,
    input: ChangeCurrentState
  ): Promise<void> {
    try {
      // get current state and workflow
      const workflow = await this.repo.getCurrentState(session, input);

      if (!workflow) {
        throw new NotFoundException(
          'could not find workflow',
          'state.workflowId'
        );
      }

      // validate the new state is a legal nextPossibleState on the current state
      const possibleState = await this.repo.validateNextState(
        session,
        input,
        workflow.stateIdentifier
      );

      if (!possibleState) {
        throw new NotFoundException(
          'new state provided is not a nextpossiblestate of current state'
        );
      }

      await this.repo.changeCurrentState(
        session,
        possibleState,
        workflow.stateIdentifier
      );
    } catch (exception) {
      this.logger.warning('could not change current state', {
        exception,
      });
      throw new ServerException('could not change current state', exception);
    }
  }

  // creates a relationship from one state to another
  // later we can create an abstracted function that creates and attaches a state to another state
  // addPossibleStateToState
  async addPossibleState(
    session: Session,
    input: PossibleState
  ): Promise<void> {
    try {
      const result = await this.repo.addPossibleState(session, input);

      if (!result) {
        throw new NotFoundException('could not make correct query result');
      }
    } catch (exception) {
      this.logger.warning('failed to add possible state to state', {
        exception,
      });
      throw new ServerException(
        'failed to add possible state to state',
        exception
      );
    }
  }

  // removePossibleStateFromState
  async removePossibleState(
    session: Session,
    input: PossibleState
  ): Promise<void> {
    try {
      await this.repo.removePossibleState(session, input);
    } catch (exception) {
      this.logger.warning('failed to remove possible state', {
        exception,
      });
      throw new ServerException('failed to remove possible state', exception);
    }
  }

  // there will be more than one required field relationship between a state node and a base node.
  // this is so each required field can be queried without inspecting the property name in app code.
  // addRequiredFieldToState
  async addRequiredField(
    session: Session,
    input: RequiredField
  ): Promise<void> {
    try {
      const field = await this.repo.getField(session, input);
      if (!field) {
        throw new NotFoundException(
          'could not find such field existing.',
          'field.propertyName'
        );
      }

      await this.repo.updateField(session, input);
    } catch (exception) {
      this.logger.warning('could not add field to state', {
        exception,
      });
      throw new ServerException('could not add field to state', exception);
    }
  }

  // listAllRequiredFieldsInAState
  async listRequiredFields(
    session: Session,
    stateId: ID
  ): Promise<RequiredFieldListOutput> {
    try {
      const result = await this.repo.listRequiredFields(session, stateId);
      return {
        items: result.filter((item) => item.value),
      };
    } catch (exception) {
      this.logger.warning('could not list fields', {
        exception,
      });
      throw new ServerException('could not list fields', exception);
    }
  }

  // removeRequiredFieldFromState
  async removeRequiredField(
    session: Session,
    input: RequiredField
  ): Promise<void> {
    try {
      await this.repo.removeRequiredField(session, input);
    } catch (exception) {
      this.logger.warning('could not remove field from state', {
        exception,
      });
      throw new ServerException('could not remove field from state', exception);
    }
  }
}
