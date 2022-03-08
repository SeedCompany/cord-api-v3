import { Args, Query, Resolver } from '@nestjs/graphql';
import { sleep } from '../common';

@Resolver()
export class WaitResolver {
  @Query(() => Boolean)
  async wait(@Args('delay') delay: string) {
    await sleep(delay);
    return true;
  }
}
