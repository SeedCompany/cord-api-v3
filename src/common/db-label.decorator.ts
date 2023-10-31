import { cleanSplit, isNotFalsy } from '@seedcompany/common';
import { uniq } from 'lodash';

export const DbLabelSymbol = Symbol('DbLabelSymbol');

export const DbLabel =
  (...labels: string[] | [null]): PropertyDecorator & ClassDecorator =>
  (target: any, key?: string | symbol) => {
    const prev: string[] =
      (key
        ? Reflect.getMetadata(DbLabelSymbol, target, key)
        : Reflect.getMetadata(DbLabelSymbol, target)) ?? [];

    const now = uniq(
      [
        ...prev,
        // Add labels split by `:`
        ...labels.flatMap((l) => cleanSplit(l ?? '', ':')),
      ].filter(isNotFalsy),
    );

    key
      ? Reflect.defineMetadata(DbLabelSymbol, now, target, key)
      : Reflect.defineMetadata(DbLabelSymbol, now, target);
    if (!key) {
      return target;
    }
  };
