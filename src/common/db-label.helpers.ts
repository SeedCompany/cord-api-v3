import { uniq } from 'lodash';
import { AbstractClass } from 'type-fest';
import { DbLabelSymbol } from './db-label.decorator';
import { getParentTypes } from './parent-types';
import { isResourceClass } from './resource.dto';

type Class = AbstractClass<any>;

export const getDbPropertyLabels = (type: Class, property: string) => {
  const labels: string[] | undefined = Reflect.getMetadata(
    DbLabelSymbol,
    type.prototype,
    property,
  );
  return uniq([...(labels ?? []), 'Property']);
};

export const getDbClassLabels = (type: Class): readonly string[] => {
  const labels = getParentTypes(type)
    .filter(isResourceClass)
    .flatMap(getDbClassOwnLabels);
  return uniq([...labels, 'BaseNode']);
};

const getDbClassOwnLabels = (type: Class): readonly string[] => {
  const decorated: string[] | null = Reflect.getOwnMetadata(
    DbLabelSymbol,
    type,
  );
  return decorated ?? [type.name];
};
