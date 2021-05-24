import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import {
  AddStateInput,
  AddStateOutput,
  ChangeCurrentStateInput,
  CreateWorkflowInput,
  CreateWorkflowOutput,
  GroupStateInput,
  PossibleStateInput,
  RequiredFieldInput,
  RequiredFieldListOutput,
  StateListOutput,
  UpdateStateInput,
} from './dto';
import { WorkflowService } from './workflow.service';

@Resolver('Workflow')
export class WorkflowResolver {
  constructor(private readonly service: WorkflowService) {}

  // Create Workflow
  @Mutation(() => CreateWorkflowOutput, {
    description: 'Create an Workflow',
  })
  async createWorkflow(
    @LoggedInSession() session: Session,
    @Args('input') { workflow: input }: CreateWorkflowInput
  ): Promise<CreateWorkflowOutput> {
    const workflow = await this.service.createWorkflow(session, input);
    return { workflow };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an Workflow',
  })
  async deleteWorkflow(
    @LoggedInSession() session: Session,
    @IdArg() workflowId: ID
  ): Promise<boolean> {
    await this.service.deleteWorkflow(session, workflowId);
    return true;
  }

  @Mutation(() => AddStateOutput, {
    description: 'Add a State to a Workflow',
  })
  async addState(
    @LoggedInSession() session: Session,
    @Args('input') { state: input }: AddStateInput
  ): Promise<AddStateOutput> {
    const state = await this.service.addState(session, input);
    return { state };
  }

  @Mutation(() => AddStateOutput, {
    description: 'Update a State',
  })
  async updateState(
    @LoggedInSession() session: Session,
    @Args('input') { state: input }: UpdateStateInput
  ): Promise<AddStateOutput> {
    const state = await this.service.updateState(session, input);
    return { state };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an State from Workflow',
  })
  async deleteState(
    @LoggedInSession() session: Session,
    @IdArg() stateId: ID
  ): Promise<boolean> {
    await this.service.deleteState(session, stateId);
    return true;
  }

  @Query(() => StateListOutput, {
    description: 'Look up all states on workflow',
  })
  async states(
    @AnonSession() session: Session,
    @IdArg() baseNodeId: ID
  ): Promise<StateListOutput> {
    return await this.service.listStates(session, baseNodeId);
  }

  @Query(() => StateListOutput, {
    description: 'Look up all next possible states on workflow',
  })
  async nextStates(
    @AnonSession() session: Session,
    @IdArg() stateId: ID
  ): Promise<StateListOutput> {
    return await this.service.listNextStates(session, stateId);
  }

  @Mutation(() => Boolean, {
    description: 'Attach securitygroup to state',
  })
  async attachSecurityGroup(
    @LoggedInSession() session: Session,
    @Args('input') { groupState: input }: GroupStateInput
  ): Promise<boolean> {
    await this.service.attachSecurityGroup(session, input);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Remove security group from state',
  })
  async removeSecurityGroup(
    @LoggedInSession() session: Session,
    @Args('input') { groupState: input }: GroupStateInput
  ): Promise<boolean> {
    await this.service.removeSecurityGroup(session, input);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Attach notification group to state',
  })
  async attachNotificationGroup(
    @LoggedInSession() session: Session,
    @Args('input') { groupState: input }: GroupStateInput
  ): Promise<boolean> {
    await this.service.attachNotificationGroup(session, input);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Remove notification group to state',
  })
  async removeNotificationGroup(
    @LoggedInSession() session: Session,
    @Args('input') { groupState: input }: GroupStateInput
  ): Promise<boolean> {
    await this.service.removeNotificationGroup(session, input);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Change current statee in workflow',
  })
  async changeCurrentState(
    @LoggedInSession() session: Session,
    @Args('input') { state: input }: ChangeCurrentStateInput
  ): Promise<boolean> {
    await this.service.changeCurrentState(session, input);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Add possible state to a state',
  })
  async addPossibleState(
    @LoggedInSession() session: Session,
    @Args('input') { state: input }: PossibleStateInput
  ): Promise<boolean> {
    await this.service.addPossibleState(session, input);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Remove possible state to a state',
  })
  async removePossibleState(
    @LoggedInSession() session: Session,
    @Args('input') { state: input }: PossibleStateInput
  ): Promise<boolean> {
    await this.service.removePossibleState(session, input);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Add a required field to a state',
  })
  async addRequiredField(
    @LoggedInSession() session: Session,
    @Args('input') { field: input }: RequiredFieldInput
  ): Promise<boolean> {
    await this.service.addRequiredField(session, input);
    return true;
  }

  @Query(() => RequiredFieldListOutput, {
    description: 'List required fields in state',
  })
  async listRequiredFields(
    @AnonSession() session: Session,
    @IdArg() stateId: ID
  ): Promise<RequiredFieldListOutput> {
    const fields = await this.service.listRequiredFields(session, stateId);
    return fields;
  }

  @Mutation(() => Boolean, {
    description: 'Remove a required field from state',
  })
  async removeRequiredField(
    @LoggedInSession() session: Session,
    @Args('input') { field: input }: RequiredFieldInput
  ): Promise<boolean> {
    await this.service.removeRequiredField(session, input);
    return true;
  }
}
