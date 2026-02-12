import { Extensions } from '@nestjs/graphql';
import type { Many } from '@seedcompany/common';

/**
 * Declare the LiveQuery config
 */
export const LiveQueryConfig = (config: {
  /**
   * This function is used by the LiveQuery store to determine which resource
   * identifiers are associated with a given field.
   * This is necessary to know which queries to update when a resource changes.
   */
  collectResourceIdentifiers?: (source: any, args: any) => Many<string>;
}) => Extensions({ liveQuery: config });
