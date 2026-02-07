import { Injectable } from '@nestjs/common';
import { ArgsType } from '@nestjs/graphql';
import { many, type Many } from '@seedcompany/common';
import { Case } from '@seedcompany/common/case';
import { type DateTime } from 'luxon';
import type { SetRequired } from 'type-fest';
import { type ID, IdField, ListField } from '~/common';
import { Identity } from '~/core/authentication';
import {
  Broadcaster,
  type BroadcastChannel as Channel,
  CompositeChannel as Composite,
} from '~/core/broadcast';
import { ProjectType as Program, type ProjectUpdate } from './dto';

@ArgsType()
export class ProjectMutationArgs {
  @ListField(() => Program, {
    description: 'Only for one of these programs/types',
    optional: true,
    empty: 'omit',
  })
  readonly program?: Many<Program>;

  @IdField({ nullable: true })
  readonly project?: ID<'Project'>;
}

export type ProjectMutationPayload = Omit<
  SetRequired<ProjectMutationArgs, keyof ProjectMutationArgs>,
  'program'
> & {
  program: Program;
  at: DateTime;
  by: ID<'Actor'>;
};

type Action = keyof Pick<ProjectChannels, 'created' | 'updated' | 'deleted'>;

/**
 * Typed channels for project events.
 */
@Injectable()
export class ProjectChannels {
  constructor(
    private readonly identity: Identity,
    private readonly broadcaster: Broadcaster,
  ) {}

  /**
   * Call publish() on the channel action for all arg/filter variations.
   */
  publishToAll<TAction extends Action>(
    action: TAction,
    payload: ReturnType<ProjectChannels[TAction]> extends Channel<
      infer T extends ProjectMutationPayload
    >
      ? Omit<T, 'by'>
      : never,
  ) {
    const by = this.identity.current.userId;
    const payloadWithBy = { ...payload, by };
    this.forAllActionChannels(action, payloadWithBy).publish(payloadWithBy);
    return payloadWithBy;
  }

  created(
    args: Omit<ProjectMutationArgs, 'project'> = {},
  ): Channel<ProjectMutationPayload> {
    return this.forAction('created', args);
  }

  deleted(args: ProjectMutationArgs = {}): Channel<ProjectMutationPayload> {
    return this.forAction('deleted', args);
  }

  updated(args: ProjectMutationArgs = {}): Channel<
    ProjectMutationPayload & {
      previous: ProjectUpdate;
      updated: ProjectUpdate;
    }
  > {
    return this.forAction('updated', args);
  }

  private forAllActionChannels<T>(
    action: Action,
    payload: ProjectMutationPayload,
  ): Channel<T> {
    return Composite.for([
      this.forAction(action, { project: payload.project }),
      this.forAction(action, { program: payload.program }),
      this.forAction(action, {}),
    ]);
  }

  private forAction<T>(action: Action, args: ProjectMutationArgs): Channel<T> {
    if (args.project) {
      if (action === 'created') {
        return this.channel([]);
      }
      return this.channel(`project:${args.project}:${action}`);
    }
    if (args.program?.length) {
      const programs = many(args.program);
      return this.channel(
        programs.map(
          (program) => `program:${Case.kebab(program)}:project:${action}`,
        ),
      );
    }
    return this.channel(`project:${action}`);
  }

  private channel<T>(channels: Many<string>): Channel<T> {
    return Composite.for(
      many(channels).map((name) => this.broadcaster.channel(name)),
    );
  }
}
