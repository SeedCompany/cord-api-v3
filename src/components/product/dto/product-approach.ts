import { registerEnumType } from '@nestjs/graphql';

/**
 * This is a roll up of methodology, for easier querying
 */
export enum ProductApproach {
  Written = 'Written',
  OralTranslation = 'OralTranslation',
  OralStories = 'OralStories',
  Visual = 'Visual',
}

registerEnumType(ProductApproach, {
  name: 'ProductApproach',
  description: 'This is a roll up of methodology, for easier querying',
});
