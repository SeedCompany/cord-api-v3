import { uniq, without } from 'lodash';
import { getParentTypes } from './parent-types';
import { isResourceClass } from './resource.dto';
import { AbstractClassType } from './types';

const DbLabelSymbol = Symbol('DbLabelSymbol');

export const DbLabel = (...labels: string[]) =>
  Reflect.metadata(DbLabelSymbol, labels);

export const getDbPropertyLabels = (
  type: AbstractClassType<unknown>,
  property: string
) => {
  // @ts-expect-error property decoration is on instance of object
  const obj = new type();
  const labels = Reflect.getMetadata(DbLabelSymbol, obj, property) as
    | string[]
    | undefined;
  const normalized = labels?.flatMap((l) => l.split(':'));
  return uniq([...(normalized ?? []), 'Property']);
};

export const getDbClassLabels = (
  type: AbstractClassType<unknown>
): readonly string[] => {
  const decorated: string[] | null = Reflect.getMetadata(DbLabelSymbol, type);
  const labels =
    decorated?.flatMap((l) => l.split(':')) ??
    without(
      getParentTypes(type)
        .filter(isResourceClass)
        .map((t) => t.name),
      'Resource'
    );
  return uniq([...labels, 'BaseNode']);
};
