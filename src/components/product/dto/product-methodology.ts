import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum, SecuredEnumList } from '../../../common';
import { ProductApproach } from './product-approach';

/**
 * How is this translation being done
 */
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

export const MethodologyToApproach: Record<
  ProductMethodology,
  ProductApproach
> = {
  // Written
  [ProductMethodology.Paratext]: ProductApproach.Written,
  [ProductMethodology.OtherWritten]: ProductApproach.Written,

  // Oral Translation
  [ProductMethodology.Render]: ProductApproach.OralTranslation,
  [ProductMethodology.OtherOralTranslation]: ProductApproach.OralTranslation,

  // Oral Stories
  [ProductMethodology.BibleStories]: ProductApproach.OralStories,
  [ProductMethodology.BibleStorying]: ProductApproach.OralStories,
  [ProductMethodology.OneStory]: ProductApproach.OralStories,
  [ProductMethodology.OtherOralStories]: ProductApproach.OralStories,

  // Visual
  [ProductMethodology.Film]: ProductApproach.Visual,
  [ProductMethodology.SignLanguage]: ProductApproach.Visual,
  [ProductMethodology.OtherVisual]: ProductApproach.Visual,
};

registerEnumType(ProductMethodology, {
  name: 'ProductMethodology',
  description: 'How is this translation being done',
});

@ObjectType({
  description: SecuredEnum.descriptionFor('a product methodology'),
})
export class SecuredMethodology extends SecuredEnum(ProductMethodology) {}

@ObjectType({
  description: SecuredEnumList.descriptionFor('methodologies'),
})
export class SecuredMethodologies extends SecuredEnumList(ProductMethodology) {}
