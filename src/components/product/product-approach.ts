import { registerEnumType } from 'type-graphql';

export enum ProductApproach {
  Written = 'written',
  OralTranslation = 'oral_translation',
  OralStories = 'oral_stories',
  Visual = 'visual',
}

registerEnumType(ProductApproach, {
  name: 'ProductApproach',
});
