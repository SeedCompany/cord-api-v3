import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import type { Client } from 'edgedb';
import {
  BehaviorSubject,
  combineLatest,
  identity,
  map,
  Observable,
} from 'rxjs';
import { Options } from './options';

export type OptionsFn = (options: Options) => Options;

export type ApplyOptions = OptionsFn | BehaviorSubject<OptionsFn>;

interface OptionsLayer {
  // The current options value for the layer
  options$: BehaviorSubject<Options>;
  // The current function that created these options from the parent layer
  mapper$: BehaviorSubject<OptionsFn>;
}

@Injectable()
export class OptionsContext
  extends AsyncLocalStorage<OptionsLayer>
  implements OnModuleDestroy
{
  private readonly root: OptionsLayer;

  constructor(root: Options) {
    super();
    this.root = {
      options$: new BehaviorSubject(root),
      mapper$: new BehaviorSubject(identity),
    };
  }

  /**
   * Creates a new option layer to use within the run function given.
   * The `applyOptions` will be given the parent options, and should return
   * the new modified options.
   * Note that this `applyOptions` function could be called multiple times
   * if the parent options change.
   */
  usingOptions<R>(applyOptions: ApplyOptions, runWith: () => R) {
    const mapper$ =
      applyOptions instanceof BehaviorSubject
        ? applyOptions
        : new BehaviorSubject(applyOptions);

    const parent$ = this.currentLayer.options$;
    // Create options' holder for this new layer
    const options$ = new BehaviorSubject<Options>(
      // @ts-expect-error initial value assigned immediately below
      undefined,
    );
    // Subscribe to both parent & mapper values/changes to refresh the current options value
    combineLatest([parent$, mapper$])
      .pipe(map(([parentOptions, mapper]) => mapper(parentOptions)))
      .subscribe(options$);

    return this.run({ options$, mapper$ }, runWith);
  }

  /**
   * @experimental
   * This replaces the current mapper for the current layer.
   * Depending on usage, another layer could be added on becoming the current one
   * replaced here.
   * Meaning that a different set of options would be replaced, which would give
   * unexpected results.
   */
  override(applyOptions: OptionsFn) {
    const current = this.getStore();
    if (!current) {
      throw new Error('Probably should not override root options layer');
    }
    current.mapper$.next(applyOptions);
  }

  private get currentLayer() {
    return this.getStore() ?? this.root;
  }
  get current$(): Observable<Options> {
    return this.currentLayer.options$;
  }
  get current() {
    return this.currentLayer.options$.value;
  }
  get currentAsLazyRef() {
    return lazyRef(() => this.current);
  }
  attachToClient(client: Client) {
    Object.assign(client, { options: this.currentAsLazyRef });
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
