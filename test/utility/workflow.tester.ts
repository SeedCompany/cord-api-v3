import { fileURLToPath } from 'url';
import { ID, UnauthorizedException } from '~/common';
import { jestSkipFileInExceptionSource } from '~/core/exception';
import { ExecuteProjectTransitionInput } from '../../src/components/project/workflow/dto';
import { ProjectWorkflow } from '../../src/components/project/workflow/project-workflow';
import { Workflow } from '../../src/components/workflow/define-workflow';
import {
  ExecuteTransitionInput,
  WorkflowTransition,
} from '../../src/components/workflow/dto';
import { TestApp } from './create-app';
import { getProjectTransitions, transitionProject } from './transition-project';

const filepath = fileURLToPath(import.meta.url);

export abstract class WorkflowTester<
  W extends Workflow,
  Transition extends InstanceType<
    ReturnType<typeof WorkflowTransition<W['state']>>
  > = InstanceType<ReturnType<typeof WorkflowTransition<W['state']>>>,
> {
  constructor(
    readonly app: TestApp,
    readonly id: ID,
    public state: W['state'],
  ) {}

  async executeByState(state: W['state']) {
    return await this.execute(
      await this.findTransition((t) => t.to === state && !t.disabled),
    );
  }

  async executeByLabel(label: string) {
    return await this.execute(
      await this.findTransition((t) => t.label === label && !t.disabled),
    );
  }

  async findTransition(iteratee: (transition: Transition) => boolean) {
    const transition = (await this.freshTransitions()).find(iteratee);
    if (!transition) {
      const e = new UnauthorizedException('This transition is not available');
      throw jestSkipFileInExceptionSource(e, filepath);
    }
    return transition;
  }

  async execute(transition: Transition) {
    try {
      const res = await this.doExecute({ transition: transition.key });
      return Object.assign(this, res);
    } catch (e) {
      throw jestSkipFileInExceptionSource(e, filepath);
    }
  }

  async bypassTo(state: W['state']) {
    try {
      const res = await this.doExecute({ bypassTo: state });
      return Object.assign(this, res);
    } catch (e) {
      throw jestSkipFileInExceptionSource(e, filepath);
    }
  }

  protected async freshTransitions() {
    if (
      this.cachedTransitions &&
      this.cachedTransitions.state === this.state &&
      this.cachedTransitions.actorId === this.app.graphql.authToken
    ) {
      return this.cachedTransitions.transitions;
    }
    const transitions = await this.fetchTransitions();
    this.cachedTransitions = {
      state: this.state,
      actorId: this.app.graphql.authToken,
      transitions,
    };
    return transitions;
  }
  private cachedTransitions: {
    state: W['state'];
    actorId: string;
    transitions: readonly Transition[];
  };

  protected abstract fetchTransitions(): Promise<readonly Transition[]>;

  protected abstract doExecute(
    input: InstanceType<ReturnType<typeof ExecuteTransitionInput<W['state']>>>,
  ): Promise<{ state: W['state']; transitions: readonly Transition[] }>;
}

export class ProjectWorkflowTester extends WorkflowTester<
  typeof ProjectWorkflow
> {
  static async for(app: TestApp, id: ID) {
    const { step: initial } = await getProjectTransitions(app, id);
    return new ProjectWorkflowTester(app, id, initial.value!);
  }

  protected async fetchTransitions() {
    const res = await getProjectTransitions(this.app, this.id);
    return res.step.transitions;
  }

  protected async doExecute(input: ExecuteProjectTransitionInput) {
    const res = await transitionProject(this.app, {
      ...input,
      project: this.id,
    });
    return {
      state: res.step.value!,
      transitions: res.step.transitions,
    };
  }
}
