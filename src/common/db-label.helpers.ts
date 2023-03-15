import { uniq } from 'lodash';
import { DbLabelSymbol } from './db-label.decorator';
import { getParentTypes } from './parent-types';
import { isResourceClass } from './resource.dto';
import { AbstractClassType } from './types';

export const getDbPropertyLabels = (
  type: AbstractClassType<unknown>,
  property: string,
) => {
  const labels: string[] | undefined = Reflect.getMetadata(
    DbLabelSymbol,
    type.prototype,
    property,
  );
  const normalized = labels?.flatMap((l) => l.split(':'));
  return uniq([...(normalized ?? []), 'Property']);
};

export const getDbClassLabels = (
  type: AbstractClassType<unknown>,
): readonly string[] => {
  const labels = getParentTypes(type)
    .filter(isResourceClass)
    .flatMap(getDbClassOwnLabels);
  return uniq([...labels, 'BaseNode']);
};

const getDbClassOwnLabels = (
  type: AbstractClassType<unknown>,
): readonly string[] => {
  const decorated: string[] | null = Reflect.getOwnMetadata(
    DbLabelSymbol,
    type,
  );
  return decorated?.flatMap((l) => l.split(':')) ?? [type.name];
};
