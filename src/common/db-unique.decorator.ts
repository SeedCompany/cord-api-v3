import { startCase } from 'lodash';
import { DbLabel } from './db-label.decorator';
import { AbstractClassType } from './types';

const DbUniqueSymbol = Symbol('DbUnique');

/**
 * This property value should have a unique constraint in database.
 * The property node needs a unique label, which can be given or will based on
 * the resource & property name.
 */
export const DbUnique =
  (label?: string): PropertyDecorator =>
  (target, propertyKey) => {
    if (typeof propertyKey === 'symbol') {
      throw new Error('DbUnique() cannot be used on symbol properties');
    }
    label ??= target.constructor.name + startCase(propertyKey);
    Reflect.defineMetadata(DbUniqueSymbol, label, target, propertyKey);
    DbLabel(label)(target, propertyKey);
  };

export const getDbPropertyUnique = (
  type: AbstractClassType<unknown>,
  property: string
): string | undefined =>
  Reflect.getMetadata(DbUniqueSymbol, type.prototype, property);
