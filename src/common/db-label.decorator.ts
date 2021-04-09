import { uniq } from 'lodash';
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
  const labels = Reflect.getMetadata(DbLabelSymbol, obj, property);
  return uniq([...(labels ?? []), 'Property']);
};
