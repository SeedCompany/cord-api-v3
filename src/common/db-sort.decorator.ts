import { createMetadataDecorator } from '@seedcompany/nest';

/**
 * A function given a cypher variable will output cypher to transform it for sorting.
 */
export type SortTransformer = (value: string) => string;

/**
 * Customize the way this field is sorted upon.
 */
export const DbSort = createMetadataDecorator({
  types: ['property'],
  setter: (transformer: SortTransformer) => transformer,
});
