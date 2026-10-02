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
import {
  type MediaReportId,
  type MediaVariant,
  ProgressReportMedia,
  type VariantGroup,
} from './media.dto';

@InputType()
export class UploadProgressReportMedia extends PickType(ProgressReportMedia, [
  'category',
]) {
  @IdField({
    description: 'The report (Progress or GTL) to attach the media to',
  })
  readonly report: MediaReportId;

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
export class ReuseProgressReportMedia {
  @IdField({
    description: stripIndent`
      The existing media item to reuse.

      Its file, category, caption and alt text are copied into a new item in
      the SAME variant group, on the same report, under the given variant.
      Typical use: a draft image is chosen for the investor report, so it is
      copied into the \`published\` variant.
    `,
  })
  readonly id: ID<ProgressReportMedia>;

  @VariantInputField(ProgressReportMedia, {
    description: 'The variant the copy is placed in',
  })
  readonly variant: Variant<MediaVariant>;
}

@InputType()
export class UpdateProgressReportMedia extends Merge(
  PickType(ProgressReportMedia, ['category']),
  MediaUserMetadata,
) {
  @IdField()
  readonly id: ID<ProgressReportMedia>;
}
