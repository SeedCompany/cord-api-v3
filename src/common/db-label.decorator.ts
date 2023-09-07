import { compact, uniq } from 'lodash';

export const DbLabelSymbol = Symbol('DbLabelSymbol');

export const DbLabel =
  (...labels: string[] | [null]): PropertyDecorator & ClassDecorator =>
  (target: any, key?: string | symbol) => {
    const prev: string[] =
      (key
        ? Reflect.getMetadata(DbLabelSymbol, target, key)
        : Reflect.getMetadata(DbLabelSymbol, target)) ?? [];

    const now = uniq(
      compact([
        ...prev,
        ...labels.flatMap((l) => l?.split(':').map((s) => s.trim())),
      ]),
    );

    key
      ? Reflect.defineMetadata(DbLabelSymbol, now, target, key)
      : Reflect.defineMetadata(DbLabelSymbol, now, target);
    if (!key) {
      return target;
    }
  };
