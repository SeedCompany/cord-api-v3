/* eslint-disable */
import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkflowService {
  // only 1 workflow per base node, only 1 base node per workflow. WF doesn't need a name, just id
  // when the workflow node is created, the :CurrentState node is created. 
  createWorkflow(token: string, baseNodeId: string, startingStateName: string) {} 
  
  deleteWorkflow(token: string, workFlowId: string) {}
  
  // the stateName is stored in the (:State)'s 'value' property (consistent with (:Property)s on (:BaseNode)s )
  addStateToWorkflow(token: string, workFlowId: string, stateName: string){} 
  
  updateStateName(token: string, stateId: string, stateName: string){}
  
  deleteStateFromWorkflow(token: string, stateId: string){}
  
  // we don't need to have a list workflow function when we have a list state function that takes the baseNodeId
  listAllStatesOnWorkflow(token: string, baseNodeId: string){} 
  
  // this will be used to get the next possible states of any state, including the current state
  listNextPossibleStates(token: string, stateId: string){} 
  
  attachSecurityGroupToState(token: string, stateId: string, securityGroupId: string){}
  
  removeSecurityGroupFromState(token: string, stateId: string, securityGroupId: string){}
  
  // we are using security groups as notification groups for now
  attachNotificationGroupToState(token: string, stateId: string, securityGroupId: string){}
  
  removeNotificationGroupFromState(token: string, stateId: string, securityGroupId: string){}
  
  changeCurrentStateInWorkflow(token: string, newStateId: string, comment: string){}

  // creates a relationship from one state to another 
  // later we can create an abstracted function that creates and attaches a state to another state 
  addPossibleStateToState(token: string, fromStateId: string, toStateId: string){}

  removePossibleStateFromState(token: string, fromStateId: string, toStateId: string){}

  // there will be more than one required field relationship between a state node and a base node. 
  // this is so each required field can be queried without inspecting the property name in app code.
  addRequiredFieldToState(token: string, stateId: string, propertyName: string){} 

  listAllRequiredFieldsInAState(token: string, stateId: string){}

  removeRequiredFieldFromState(token: string, stateId: string, propertyName: string){} 
}
