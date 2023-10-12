import { EnumType, makeEnum } from '~/common';

/**
 * This is a roll up of methodology, for easier querying
 */
export type ProductApproach = EnumType<typeof ProductApproach>;
export const ProductApproach = makeEnum({
  name: 'ProductApproach',
  description: 'This is a roll up of methodology, for easier querying',
  values: ['Written', 'OralTranslation', 'OralStories', 'Visual'],
});
