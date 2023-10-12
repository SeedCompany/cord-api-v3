import { ObjectType } from '@nestjs/graphql';
import { invertBy } from 'lodash';
import { EnumType, makeEnum, SecuredEnum, SecuredEnumList } from '~/common';
import { ProductApproach as Approach } from './product-approach.enum';

/**
 * How is this translation being done
 */
export type ProductMethodology = EnumType<typeof ProductMethodology>;
export const ProductMethodology = makeEnum({
  name: 'ProductMethodology',
  description: 'How is this translation being done',
  values: [
    // Written
    'Paratext',
    'OtherWritten',
    // Oral Translation
    'Render',
    'Audacity',
    'AdobeAudition',
    'OtherOralTranslation',
    // Oral Stories
    'StoryTogether',
    'SeedCompanyMethod',
    'OneStory',
    'Craft2Tell',
    'OtherOralStories',
    // Visual
    'Film',
    'SignLanguage',
    'OtherVisual',
  ],
});

@ObjectType({
  description: SecuredEnum.descriptionFor('a product methodology'),
})
export class SecuredMethodology extends SecuredEnum(ProductMethodology) {}

@ObjectType({
  description: SecuredEnumList.descriptionFor('methodologies'),
})
export class SecuredMethodologies extends SecuredEnumList(ProductMethodology) {}

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
  MethodologyToApproach,
) as Record<Approach, ProductMethodology[]>;
