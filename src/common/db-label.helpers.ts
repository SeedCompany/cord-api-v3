import { uniq, without } from 'lodash';
import { DbLabelSymbol } from './db-label.decorator';
import { getParentTypes } from './parent-types';
import { isResourceClass } from './resource.dto';
import { AbstractClassType } from './types';

export const getDbPropertyLabels = (
  type: AbstractClassType<unknown>,
  property: string
) => {
  const labels: string[] | undefined = Reflect.getMetadata(
    DbLabelSymbol,
    type.prototype,
    property
  );
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
