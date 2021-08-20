import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { invertBy } from 'lodash';
import { SecuredEnum, SecuredEnumList } from '../../../common';
import { ProductApproach as Approach } from './product-approach';

/**
 * How is this translation being done
 */
export enum ProductMethodology {
  // Written
  Paratext = 'Paratext',
  OtherWritten = 'OtherWritten',

  // Oral Translation
  Render = 'Render',
  Audacity = 'Audacity',
  AdobeAudition = 'AdobeAudition',
  OtherOralTranslation = 'OtherOralTranslation',

  // Oral Stories
  StoryTogether = 'StoryTogether',
  SeedCompanyMethod = 'SeedCompanyMethod',
  OneStory = 'OneStory',
  Craft2Tell = 'Craft2Tell',
  OtherOralStories = 'OtherOralStories',

  // Visual
  Film = 'Film',
  SignLanguage = 'SignLanguage',
  OtherVisual = 'OtherVisual',
}

export const MethodologyToApproach: Record<ProductMethodology, Approach> = {
  // Written
  [ProductMethodology.Paratext]: Approach.Written,
  [ProductMethodology.OtherWritten]: Approach.Written,

  // Oral Translation
  [ProductMethodology.Render]: Approach.OralTranslation,
  [ProductMethodology.Audacity]: Approach.OralTranslation,
  [ProductMethodology.AdobeAudition]: Approach.OralTranslation,
  [ProductMethodology.OtherOralTranslation]: Approach.OralTranslation,

  // Oral Stories
  [ProductMethodology.StoryTogether]: Approach.OralStories,
  [ProductMethodology.SeedCompanyMethod]: Approach.OralStories,
  [ProductMethodology.OneStory]: Approach.OralStories,
  [ProductMethodology.Craft2Tell]: Approach.OralStories,
  [ProductMethodology.OtherOralStories]: Approach.OralStories,

  // Visual
  [ProductMethodology.Film]: Approach.Visual,
  [ProductMethodology.SignLanguage]: Approach.Visual,
  [ProductMethodology.OtherVisual]: Approach.Visual,
};

export const ApproachToMethodologies = invertBy(
  MethodologyToApproach
) as Record<Approach, ProductMethodology[]>;

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
