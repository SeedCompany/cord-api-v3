import { Field, InputType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  IdField,
  type IdOf,
  IntersectTypes as Merge,
  PickType,
  Variant,
  VariantInputField,
} from '~/common';
import { CreateDefinedFileVersionInput } from '../../../file/dto';
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
  readonly reportId: IdOf<ProgressReport>;

  @Field()
  readonly file: CreateDefinedFileVersionInput;

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
  readonly id: IdOf<ProgressReportMedia>;
}
