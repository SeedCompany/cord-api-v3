import {
  Args,
  Mutation,
  ObjectType,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type Cron } from 'croner';
import { UnauthorizedException } from '~/common';
import { Identity } from '~/core/authentication';
import { Scheduler } from '../scheduler.service';

@ObjectType('ScheduledTaskModifier')
class Modifier {
  task: Cron;
}

@Resolver(Modifier)
export class ScheduledTaskModifierResolver {
  constructor(
    private readonly identity: Identity,
    private readonly scheduler: Scheduler,
  ) {}

  @Mutation(() => Modifier, { nullable: true })
  scheduledTask(@Args('name') name: string): Modifier | null {
    if (!this.identity.isAdmin) {
      throw new UnauthorizedException();
    }
    const task = this.scheduler.tryGet(name);
    return task ? { task } : null;
  }

  @ResolveField(() => Boolean)
  pause(@Parent() { task }: Modifier) {
    return task.pause();
  }

  @ResolveField(() => Boolean)
  resume(@Parent() { task }: Modifier) {
    return task.resume();
  }

  @ResolveField(() => Boolean)
  trigger(@Parent() { task }: Modifier) {
    void task.trigger();
    return true;
  }
}
