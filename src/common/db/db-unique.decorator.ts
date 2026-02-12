import { createMetadataDecorator } from '@seedcompany/nest';
import { startCase } from 'lodash';
import { DbLabel } from './db-label.decorator';

/**
 * This property value should have a unique constraint in the neo4j database.
 * The property node needs a unique label, which can be given or will be based on
 * the resource & property name.
 */
export const DbUnique = (label?: string) => (target: object, key: string) => {
  label ??= target.constructor.name + startCase(key);
  DbUniqueInner(label)(target, key);
  DbLabel(label)(target, key);
};

const DbUniqueInner = createMetadataDecorator({
  types: ['property'],
  setter: (label?: string) => label,
});

DbUnique.get = DbUniqueInner.get;
