import { ObjectType, registerEnumType } from 'type-graphql';
import { SecuredPropertyList } from '../../../common';

export enum ProductMethodology {
  // Written
  Paratext = 'Paratext',
  OtherWritten = 'OtherWritten',

  // Oral Translation
  Render = 'Render',
  OtherOralTranslation = 'OtherOralTranslation',

  // Oral Stories
  BibleStories = 'BibleStories',
  BibleStorying = 'BibleStorying',
  OneStory = 'OneStory',
  OtherOralStories = 'OtherOralStories',

  // Visual
  Film = 'Film',
  SignLanguage = 'SignLanguage',
  OtherVisual = 'OtherVisual',
}

registerEnumType(ProductMethodology, {
  name: 'ProductMethodology',
});

@ObjectType({
  description: SecuredPropertyList.descriptionFor('methodologies'),
})
export class SecuredMethodologies extends SecuredPropertyList(
  ProductMethodology
) {}
