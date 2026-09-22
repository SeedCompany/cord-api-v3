import { Field, InputType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  type ID,
  IdField,
  IntersectTypes as Merge,
  PickType,
  Variant,
  VariantInputField,
} from '~/common';
import { CreateDefinedFileVersion } from '../../../file/dto';
import { MediaUserMetadata } from '../../../file/media/media.dto';
import { type ProgressReport } from '../../dto';
import {
  type MediaVariant,
  ProgressReportMedia,
  type VariantGroup,
} from './media.dto';

@InputType()
export class UploadProgressReportMedia extends PickType(ProgressReportMedia, [
  'category',
]) {
  @IdField()
  readonly report: ID<ProgressReport>;

  @Field()
  readonly file: CreateDefinedFileVersion;

  @VariantInputField(ProgressReportMedia)
  readonly variant: Variant<MediaVariant>;

  @IdField({
    description: stripIndent`
      Associate this media with an existing set of media.
      Idea being the "same image" across multiple variants.
      Group might not be the best name for this.

      If none is given a new group will be created.
    `,
    nullable: true,
  })
  readonly variantGroup?: VariantGroup;
}

@InputType()
export class UpdateProgressReportMedia extends Merge(
  PickType(ProgressReportMedia, ['category']),
  MediaUserMetadata,
) {
  @IdField()
  readonly id: ID<ProgressReportMedia>;
}

@InputType()
export class ReuseProgressReportMedia {
  @IdField({
    description: stripIndent`
      An existing media item — from any variant — to duplicate the uploaded
      file from. The copy becomes its own file, so its caption/category can
      be edited independently of the source afterwards.
    `,
  })
  readonly id: ID<ProgressReportMedia>;

  @VariantInputField(ProgressReportMedia, {
    description: 'Which variant the duplicated file is uploaded into.',
  })
  readonly variant: Variant<MediaVariant>;
}
