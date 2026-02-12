import { createMetadataDecorator } from '@seedcompany/nest';

/**
 * Customize the way this field is sorted upon.
 */
export const DbSort = createMetadataDecorator({
  types: ['property'],
  setter: (transformer: DbSort.Transformer) => transformer,
});

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DbSort {
  /**
   * A function given a cypher variable will output cypher to transform it for sorting.
   */
  export type Transformer = (value: string) => string;
}
