import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { Options } from './options';

export type OptionsFn = (options: Options) => Options;

@Injectable()
export class OptionsContext
  extends AsyncLocalStorage<Options>
  implements OptionsContext, OnModuleDestroy
{
  constructor(@Inject('DEFAULT_OPTIONS') readonly root: Options) {
    super();
  }

  async usingOptions<R>(applyOptions: OptionsFn, runWith: () => Promise<R>) {
    const options = applyOptions(this.current);
    return await this.run(options, runWith);
  }

  get current() {
    return this.getStore() ?? this.root;
  }
  get currentAsLazyRef() {
    return lazyRef(() => this.current);
  }

  onModuleDestroy() {
    this.disable();
  }
}

/**
 * Returns "an object" that calls the given function every time
 * it's referenced to get the actual object.
 */
const lazyRef = <T extends object>(getter: () => T): T => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return new Proxy({} as T, {
    get(target: T, p: string, receiver: unknown) {
      return Reflect.get(getter(), p, receiver);
    },
  });
};
