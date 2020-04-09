/* eslint-disable */
import { Injectable, NotImplementedException, NotFoundException } from '@nestjs/common';
import { generate } from 'shortid';
import { node, relation } from 'cypher-query-builder';
import { ISession } from '../../common';
import { CreateWorkflow, Workflow, AddState, State, UpdateState, StateListOutput, GroupState, ChangeState, PossibleState, RequiredField, RequiredFieldListOutput, FiledObject } from './dto';
import { Logger, ILogger, DatabaseService, matchSession } from '../../core';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly db: DatabaseService,
    @Logger('workflow.service') private readonly logger: ILogger
  ) {}

  async readOneState(session: ISession, stateId: string): Promise<State> {
    const result = await this.db
      .query()
      .match([
        node('token', 'Token', {
          active: true,
          value: session.token
        }),
        relation('in', '', 'token', {
          active: true,
        }),
        node('requestingUser', 'User', {
          id: session.userId
        }),
        relation('in', '', 'member', {
          admin: true
        }),
        node('sg'),
        relation('in', '', 'securityGroup', {
          active: true
        }),
        node('state', 'State', {
          id: stateId
        })
      ])
      .return([
        {
          state: [
            {id: 'id'},
            {value: 'value'}
          ]
        }
      ])
      .first();

    if( !result ) {
      throw new NotFoundException('could not find a state');
    }

    return {
      id: result.id,
      value: result.value
    }
  }

  // multiple workflows will be able to be created per one base node.
  async createWorkflow(session: ISession, input: CreateWorkflow) : Promise<Workflow> {
    try {
      const workflowId = generate();

      const result = await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token
            }),
            relation('in', '', 'token', {
              active: true
            }),
            node('user', 'User'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode', 'BaseNode', {
              id: input.baseNodeId
            }),
          ],
        ])
        .merge([
          [
            node('baseNode'),
            relation('out', '', 'workflow', {
              active: true
            }),
            node('workflow', 'Workflow', {
              id: workflowId,
              stateIdentifier: input.stateIdentifier,
            })
          ],
        ])
        .merge([
          [
            node('workflow'),
            relation('out', '', 'possibleState', {
              active: true,
              startingState: true
            }),
            node('state', 'State', {
              id: generate(),
              value: input.startingStateName
            })
          ],
        ])
        .merge([
          [
            node('baseNode'),
            relation('out', '', `${input.stateIdentifier}`, {
              active: true
            }),
            node('currentState', 'CurrentState', {
              value: input.startingStateName
            })
          ],
        ])
        .return({
          workflow: [
            { id: 'id' },
            { stateIdentifier: 'stateIdentifier' },
          ]
        })
        .first();

    if( !result ) {
      throw new NotFoundException('could not create a workflow');
    }

    return {
      id: result.id,
      stateIdentifier: result.stateIdentifier
    }

    } catch (e) {
      this.logger.warning('Failed to create workflow', {
        exception: e
      })

      throw new Error('Could not create workflow');
    }
  };

  async deleteWorkflow(session: ISession, workflowId: string) : Promise<void> {
    try {
      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token
            }),
            relation('in', '', 'token', {
              active: true
            }),
            node('user', 'User'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode'),
            relation('out', '', 'workflow', {
              active: true
            }),
            node('workflow', 'Workflow', {
              id: workflowId
            })
          ],
        ])
        .detachDelete('workflow')
        .run()

    } catch (e) {
      this.logger.warning('Failed to delete workflow', {
        exception: e,
      });

      throw e;
    }
  };

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
              value: session.token
            }),
            relation('in', '', 'token', {
              active: true
            }),
            node('user'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode'),
            relation('out', '', 'workflow', {
              active: true
            }),
            node('workflow', 'Workflow', {
              id: input.workflowId
            })
          ]
        ])
        .merge([
          [
            node('workflow'),
            relation('out', '', 'possibleState', {
              active: true,
              startingState: false
            }),
            node('state', 'State', {
              id: stateId,
              value: input.stateName
            })
          ]
        ])
        .return({
          state: [
            { id: 'id' },
            { value: 'value' }
          ]
        })
        .first();

      if( !result ) {
        throw new NotFoundException('could not create a state');
      }

      return {
        id: result.id,
        value: result.value
      };

    } catch (e) {
      this.logger.warning('could not add new state to a workflow', {
        exception: e
      });
      throw e;
    }
  };

  // updateStateName
  async updateState(session: ISession, input: UpdateState): Promise<State> {
    try {
      const result = await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token
            }),
            relation('in', '', 'token', {
              active: true
            }),
            node('user'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode'),
            relation('out', '', 'workflow', {
              active: true
            }),
            node('workflow'),
            relation('out', '', 'possibleState', {
              active: true,
              startingState: true
            }),
            node('state', 'State', {
              id: input.stateId
            })
          ]
        ])
        .set({
          values: {
            'state.value': input.stateName
          }
        })
        .return({
          state: [
            { id: 'id' },
            { value: 'value' }
          ]
        })
        .first();

      if( !result ) {
        throw new NotFoundException('could not update a state');
      }

      return {
        id: result.id,
        value: result.value
      };

    } catch (e) {
      this.logger.warning('could not update state', {
        exception: e
      });
      throw e;
    }
  };

  // deleteStateFromWorkflow
  async deleteState(session: ISession, stateId: string) : Promise<void> {
    try {
      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token
            }),
            relation('in', '', 'token', {
              active: true
            }),
            node('user'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode'),
            relation('out', '', 'workflow', {
              active: true
            }),
            node('workflow'),
            relation('out', '', 'possibleState', {
              active: true,
            }),
            node('state', 'State', {
              id: stateId
            })
          ]
        ])
        .detachDelete('state')
        .first();

    } catch (e) {
      this.logger.warning('Failed to delete state', {
        exception: e,
      });

      throw e;
    }
  };

  // we don't need to have a list workflow function when we have a list state function that takes the baseNodeId // listAllStatesOnWorkflow
  async listStates(session: ISession, baseNodeId: string): Promise<StateListOutput>{
    try {
      const result = (await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token
            }),
            relation('in', '', 'token', {
              active: true
            }),
            node('user'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode', 'BaseNode', {
              id: baseNodeId
            }),
            relation('out', '', 'workflow', {
              active: true
            }),
            node('workflow'),
            relation('out', '', 'possibleState', {
              active: true,
            }),
            node('state')
          ]
        ])
        .return({
          state:[
            { id: 'id' },
            { value: 'value' }
          ]
        })
        .run()) as State[];

      return { items: result.filter(item => item.id && item.value) };

    } catch (e) {
      this.logger.warning('Failed to delete state', {
        exception: e,
      });

      throw e;
    }
  };

  // this will be used to get the next possible states of any state, including the current state  // listNextPossibleStates
  async listNextStates(_session: ISession, stateId: string): Promise<StateListOutput>{
    try {
      // WIP, not sure how to check session in this function
      const result = (await this.db
        .query()
        .match([
          [
            node('state', 'State', {
              id: stateId
            }),
            relation('out', '', 'nextPossibleState', {
              active: true
            }),
            node('nextState')
          ]
        ])
        .return({
          nextState:[
            { id: 'id' },
            { value: 'value' }
          ]
        })
        .run()) as State[];

      return { items: result.filter(item => item.id && item.value) };

    } catch (e) {
      this.logger.warning('Failed to delete state', {
        exception: e,
      });

      throw e;
    }
  };

  // attachSecurityGroupToState
  async attachSecurityGroup(session: ISession, input: GroupState): Promise<void>{
    try{
      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('requestingUser', 'User', {
              id: session.userId
            }),
            relation('in', '', 'member', {
              admin: true
            }),
            node('sg', 'SecurityGroup', {
              id: input.securityGroupId
            }),
          ],
          [
            node('requestingUser'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode', 'BaseNode')
          ],
          [
            node('state', 'State', {
              id: input.stateId
            })
          ]
        ])
        .merge([
          [
            node('state'),
            relation('out', '', 'securityGroup', {
              active: true
            }),
            node('sg')
          ]
        ])
        .first();

    } catch (e) {
      this.logger.warning('could not attach security group to state', {
        exception: e
      });
      throw e;
    }
  };

  // removeSecurityGroupFromState
  async removeSecurityGroup(session: ISession, input: GroupState): Promise<void>{
    try{
      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('requestingUser', 'User', {
              id: session.userId
            }),
            relation('in', '', 'member', {
              admin: true
            }),
            node('sg', 'SecurityGroup', {
              id: input.securityGroupId
            })
          ],
          [
            node('requestingUser'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode', 'BaseNode')
          ],
          [
            node('state', 'State', {
              id: input.stateId
            }),
            relation('out', 'rel', 'securityGroup'),
            node('sg')
          ]
        ])
        .detachDelete('rel')
        .first();

    } catch (e) {
      this.logger.warning('could not remove security group from state', {
        exception: e
      });
      throw e;
    }
  }

  // we are using security groups as notification groups for now
  // attachNotificationGroupToState
  async attachNotificationGroup(session: ISession, input: GroupState): Promise<void>{
    try{
      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('requestingUser', 'User', {
              id: session.userId
            }),
            relation('in', '', 'member'),
            node('sg', 'SecurityGroup', {
              id: input.securityGroupId
            }),
          ],
          [
            node('requestingUser'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode', 'BaseNode')
          ],
          [
            node('state', 'State', {
              id: input.stateId
            })
          ]
        ])
        .merge([
          [
            node('state'),
            relation('out', '', 'notification', {
              active: true,
              onEnter: true
            }),
            node('sg')
          ]
        ])
        .first();

    } catch (e) {
      this.logger.warning('could not attach security group to state', {
        exception: e
      });
      throw e;
    }
  }

  // removeNotificationGroupFromState
  async removeNotificationGroup(session: ISession, input: GroupState): Promise<void>{
    try{
      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token
            }),
            relation('in', '', 'token', {
              active: true,
            }),
            node('requestingUser', 'User', {
              id: session.userId
            }),
            relation('in', '', 'member'),
            node('sg', 'SecurityGroup', {
              id: input.securityGroupId
            })
          ],
          [
            node('requestingUser'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode', 'BaseNode')
          ],
          [
            node('state', 'State', {
              id: input.stateId
            }),
            relation('out', 'rel', 'notification'),
            node('sg')
          ]
        ])
        .detachDelete('rel')
        .first();

    } catch (e) {
      this.logger.warning('could not remove security group from state', {
        exception: e
      });
      throw e;
    }
  }

  // changeCurrentStateInWorkflow
  async changeCurrentState(session: ISession, input: ChangeState): Promise<void>{
    try{
      // get current state and workflow
      const currentStateAndWorkflow = await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'member', {
              admin: true
            }),
            node('sg', 'SecurityGroup'),
            relation('out', '', 'permission'),
            node('permission', 'Permission', {
              read: true
            }),
            relation('out', '', 'baseNode'),
            node('baseNode', 'BaseNode'),
            relation('out', '', 'currentState'),
            node('currentState')
          ],
          [
            node('baseNode'),
            relation('out', '', 'workflow', {
              active: true
            }),
            node('workflow')
          ]
        ])
        .return({
          currentState: [
            { value: 'value' },
          ],
          workflow: [
            { stateIdentifier: 'stateIdentifier' }
          ]
        })
        .first();

      if( !currentStateAndWorkflow ) {
        throw new NotFoundException('could not find current state and workflow');
      }

      // validate the new state is a legal nextPossibleState on the current state
      const possibleState = await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'member', {
              admin: true
            }),
            node('sg', 'SecurityGroup'),
            relation('in', '', 'securityGroup', {
              active: true
            }),
            node('state', 'State', {
              value: currentStateAndWorkflow.value
            }),
            relation('out', '', 'nextPossibleState', {
              active: true
            }),
            node('state', 'State', {
              id: input.newStateId
            })
          ]
        ])
        .return({
          state: [
            { value: 'value' }
          ]
        })
        .first();

      if( !possibleState ) {
        throw new NotFoundException('new state provided is not a nextpossiblstate of current state');
      }

      await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'member', {
              admin: true
            }),
            node('sg', 'SecurityGroup'),
            relation('out', '', 'permission'),
            node('permission', 'Permission', {
              write: true,
            }),
            relation('out', '', 'baseNode'),
            node('baseNode', 'BaseNode'),
            relation('out', 'oldRel', 'currentState'),
            node('currentState', 'CurrentState', {
              value: currentStateAndWorkflow.value
            })
          ]
        ])
        .set({
          values: {
            'oldRel.active': false
          }
        })
        .merge([
          [
            node('baseNode'),
            relation('out', '', `${currentStateAndWorkflow.stateIdentifier}`, {
              active: true
            }),
            node('newCurrentState', 'CurrentState', {
              value: possibleState.value
            })
          ]
        ])
        .run();
    } catch (e) {
      this.logger.warning('could not change current state', {
        exception: e
      });
      throw e;
    }
  }

  // creates a relationship from one state to another
  // later we can create an abstracted function that creates and attaches a state to another state
  // addPossibleStateToState
  async addPossibleState(session: ISession, input: PossibleState): Promise<void>{
    try{
      const result = await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'member', {
              admin: true
            }),
            node('sg', 'SecurityGroup')
          ],
          [
            node('requestingUser'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode', 'BaseNode')
          ],
          [
            node('fromState', 'State', {
              id: input.fromStateId
            })
          ],
          [
            node('toState', 'State', {
              id: input.toStateId
            })
          ]
        ])
        .merge([
          node('fromState'),
          relation('out', '', 'nextPossibleState', {
            active: true
          }),
          node('toState')
        ])
        .first();
      
      if ( !result ) {
        throw new NotFoundException('could not make correct query result');
      }

    } catch (e) {
      this.logger.warning('failed to add possible state to state', {
        exception: e
      });
      throw e;
    }
  }

  // removePossibleStateFromState
  async removePossibleState(session: ISession, input: PossibleState): Promise<void>{
    try{
      await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'member', {
              admin: true
            }),
            node('sg', 'SecurityGroup'),
            relation('in', '', 'securityGroup', {
              active: true
            }),
            node('fromState', 'State', {
              id: input.fromStateId
            }),
            relation('out', 'rel', 'nextPossibleState', {
              active: true
            }),
            node('toState', 'State', {
              id: input.toStateId
            })
          ],
          [
            node('requestingUser'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode', 'BaseNode')
          ],
        ])
        .detachDelete('rel')
        .run();

    } catch (e) {
      this.logger.warning('failed to remove possible state from state', {
        exception: e
      });
      throw e;
    }
  }

  // there will be more than one required field relationship between a state node and a base node.
  // this is so each required field can be queried without inspecting the property name in app code.
  // addRequiredFieldToState
  async addRequiredField(session: ISession, input: RequiredField): Promise<void>{
    try{
      const field = await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token
            }),
            relation('in', '', 'token', {
              active: true
            }),
            node('user'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode'),
            relation('out', '', `${input.propertyName}`),
            node('property')
          ]
        ])
        .return({
          property: 'property'
        })
        .first();

      if ( !field ) {
        throw new NotFoundException('could not find such field existing.');
      }

      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token
            }),
            relation('in', '', 'token', {
              active: true
            }),
            node('user'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode')
          ],
          [
            node('state', 'State', {
              id: input.stateId
            })
          ]
        ])
        .merge([
          node('baseNode'),
          relation('in', '', 'requiredProperty', {
            value: input.propertyName
          }),
          node('state')
        ])
        .first();

    } catch (e) {
      this.logger.warning('could not add field to state', {
        exception: e
      });
      throw e;
    }
  }

  // listAllRequiredFieldsInAState
  async listRequiredFields(session: ISession, stateId: string): Promise<RequiredFieldListOutput>{
    try{
      const result = (await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'member'),
            node('sg', 'SecurityGroup'),
            relation('in', '', 'securityGroup', {
              active: true
            }),
            node('state', 'State', {
              id: stateId
            }),
            relation('out', 'rel', 'requiredProperty'),
            node('baseNode', 'BaseNode')
          ],
          [
            node('sg'),
            relation('out', '', 'permission'),
            node('permission', 'Permission', {
              read: true
            }),
            relation('out', '', 'baseNode'),
            node('baseNode')
          ]
        ])
        .return({
          'rel.value': 'value'          
        })
        .run()) as FiledObject[];

      return {
        items: result.filter(item => item.value)
      }

    } catch (e) {
      this.logger.warning('could not list fields', {
        exception: e
      });
      throw e;
    }
  }

  // removeRequiredFieldFromState
  async removeRequiredField(session: ISession, input: RequiredField): Promise<void>{
    try{
      await this.db
        .query()
        .match([
          [
            node('token', 'Token', {
              active: true,
              value: session.token
            }),
            relation('in', '', 'token', {
              active: true
            }),
            node('user'),
            relation('in', '', 'admin', {
              active: true
            }),
            node('baseNode'),
            relation('in', 'rel', 'requiredProperty', {
              value: input.propertyName
            }),
            node('state', 'State', {
              id: input.stateId
            })
          ]
        ])
        .detachDelete('rel')
        .run();

    } catch (e) {
      this.logger.warning('could not remove field from state', {
        exception: e
      });
      throw e;
    }
  }
}
