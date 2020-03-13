import { registerEnumType } from 'type-graphql';

export enum ProductApproach {
  Written = 'Written',
  OralTranslation = 'OralTranslation',
  OralStories = 'OralStories',
  Visual = 'Visual',
}

registerEnumType(ProductApproach, {
  name: 'ProductApproach',
});
