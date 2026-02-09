import { Injectable } from '@nestjs/common';
import { ArgsType } from '@nestjs/graphql';
import { many, type Many } from '@seedcompany/common';
import { Case } from '@seedcompany/common/case';
import type { UnsecuredDto } from '~/common';
import { Identity } from '~/core/authentication';
import {
  Broadcaster,
  type BroadcastChannel as Channel,
  CompositeChannel as Composite,
} from '~/core/broadcast';
import { type ProjectStep } from '../dto';
import {
  ProjectMutationArgs,
  type ProjectMutationPayload,
} from '../project.channels';
import { type ProjectWorkflowEvent } from './dto';

@ArgsType()
export class ProjectWorkflowMutationArgs extends ProjectMutationArgs {}

export type ProjectWorkflowMutationPayload = ProjectMutationPayload & {
  from: ProjectStep;
  event: UnsecuredDto<ProjectWorkflowEvent>;
};

type Action = 'transitioned';

/**
 * Typed channels for project workflow/transition events.
 */
@Injectable()
export class ProjectWorkflowChannels {
  constructor(
    private readonly identity: Identity,
    private readonly broadcaster: Broadcaster,
  ) {}

  /**
   * Call publish() on the channel for all arg/filter variations.
   */
  publishToAll(
    action: Action,
    payload: Omit<ProjectWorkflowMutationPayload, 'by'>,
  ) {
    const by = this.identity.current.userId;
    const payloadWithBy = { ...payload, by };
    this.forAllChannels(action, payloadWithBy).publish(payloadWithBy);
    return payloadWithBy;
  }

  transitioned(
    args: ProjectWorkflowMutationArgs = {},
  ): Channel<ProjectWorkflowMutationPayload> {
    return this.forAction('transitioned', args);
  }

  private forAllChannels<T>(
    action: Action,
    payload: ProjectWorkflowMutationPayload,
  ): Channel<T> {
    return Composite.for([
      this.forAction(action, { project: payload.project }),
      this.forAction(action, { program: payload.program }),
      this.forAction(action, {}),
    ]);
  }

  private forAction<T>(
    action: Action,
    args: ProjectWorkflowMutationArgs,
  ): Channel<T> {
    if (args.project) {
      return this.channel(`project-workflow:${args.project}:${action}`);
    }
    if (args.program?.length) {
      const programs = many(args.program);
      return this.channel(
        programs.map(
          (program) =>
            `program:${Case.kebab(program)}:project-workflow:${action}`,
        ),
      );
    }
    return this.channel(`project-workflow:${action}`);
  }

  private channel<T>(channels: Many<string>): Channel<T> {
    return Composite.for(
      many(channels).map((name) => this.broadcaster.channel(name)),
    );
  }
}
