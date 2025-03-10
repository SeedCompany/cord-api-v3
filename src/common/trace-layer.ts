import { cacheable, cached } from '@seedcompany/common';
import { patchDecoratedMethod as patchMethod } from '@seedcompany/nest';
import { AsyncLocalStorage } from 'async_hooks';
import { AbstractClass } from 'type-fest';
import { getParentTypes as getHierarchyList } from './parent-types';

export type TraceNames = Readonly<{
  cls: string;
  /** The parent class that declares the method when it is not the current class */
  ownCls?: string;
  method: string;
}>;

/**
 * A performant way to identify certain methods in the call stack.
 *
 * This class helps to wrap class methods
 * and store their names in an AsyncLocalStorage.
 * This allows helper methods to identify who called them,
 * assuming they've been preconfigured.
 *
 * Traces are wrapped with a "layer"/"group" name.
 * This allows different groups of methods to be intertwined in the call
 * stack without conflicting with each other.
 * Multiple layers can be applied to the same method, independently.
 *
 * Best starting point is {@link applyToInstance}
 * ```ts
 * class Foo {
 *   constructor() {
 *     TraceLayer.as('logic').applyToInstance(this);
 *   }
 * }
 * ```
 * This capture approach is best because it automatically
 * applies to subclasses and applies to inherited methods.
 *
 * Next best is {@link applyToClass}
 * ```ts
 * @TraceLayer.as('logic').applyToClass()
 * class Foo {}
 * ```
 * This applies to all owned & inherited methods.
 *
 * The current stack can be pulled anywhere with
 * ```ts
 * TraceLayer.as('logic').currentStack;
 * ```
 * This gives a list of call names ordered by most recent.
 * ```ts
 *  const { cls, method } = currentStack?.[0] ?? {};
 * ```
 */
export class TraceLayer {
  private static readonly layers = new AsyncLocalStorage<{
    readonly [layer in string]?: readonly TraceNames[];
  }>();
  private static readonly instances = new Map<string, TraceLayer>();
  private static readonly getNameCacheForInstance = cacheable<
    object,
    Map<string, TraceNames>
  >(new WeakMap(), () => new Map());

  private readonly seenClasses = new WeakSet<AbstractClass<unknown>>();

  private constructor(readonly layer: string) {}

  static as(layer: string) {
    return cached(TraceLayer.instances, layer, () => new TraceLayer(layer));
  }

  /**
   * This gives a list of call names, if any, ordered by most recent.
   * The identity of these entries is maintained,
   * allowing them to be used as cache keys.
   */
  get currentStack() {
    const layers = TraceLayer.layers.getStore();
    return layers?.[this.layer];
  }

  /**
   * A shortcut to create a memoized function that takes the current trace
   * and converts it to another shape.
   */
  makeGetter<T>(mapFnCached: (names: TraceNames) => T) {
    const cache = new WeakMap();
    return () => {
      const names = this.currentStack?.[0];
      return names ? cached(cache, names, mapFnCached) : undefined;
    };
  }

  applyToClass(): ClassDecorator {
    return (target) => {
      this.applyToStaticClass(target as any);
    };
  }

  applyToInstance(obj: InstanceType<AbstractClass<any>>) {
    this.applyToStaticClass(obj.constructor);
  }

  applyToStaticClass(cls: AbstractClass<unknown>) {
    for (const aClass of getHierarchyList(cls)) {
      this.applyToOwnStaticClass(aClass);
    }
  }

  applyToOwnStaticClass(cls: AbstractClass<unknown>) {
    if (this.seenClasses.has(cls)) {
      return;
    }
    this.seenClasses.add(cls);

    const proto = cls.prototype;
    const descriptors = Object.getOwnPropertyDescriptors(proto);
    const methods = Object.entries(descriptors).flatMap(([key, descriptor]) => {
      return key !== 'constructor' && typeof descriptor.value === 'function'
        ? [key]
        : [];
    });

    const layer = this.layer;
    for (const name of methods) {
      patchMethod(proto as any, name, (original) => {
        return function (...args) {
          const nameCache = TraceLayer.getNameCacheForInstance(this);
          const names = cached(nameCache, name, (): TraceNames => {
            const cls = this.constructor.name;
            const ownCls = proto.constructor.name;
            return {
              cls: cls,
              ...(cls !== ownCls && { ownCls }),
              method: name,
            };
          });

          const prev = TraceLayer.layers.getStore();
          const next = {
            ...prev,
            [layer]: [names, ...(prev?.[layer] ?? [])],
          };
          return TraceLayer.layers.run(next, original, ...args);
        };
      });
    }
  }
}
