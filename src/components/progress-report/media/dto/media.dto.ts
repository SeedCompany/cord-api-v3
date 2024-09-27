import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { setOf } from '@seedcompany/common';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  IdField,
  IdOf,
  Resource,
  SecuredProps,
  Variant,
  VariantOf,
} from '~/common';
import { LinkTo } from '~/core';
import { SetDbType } from '~/core/database';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import { FileId } from '../../../file/dto';
import { Media } from '../../../file/media/media.dto';
import { ProgressReport } from '../../dto';
import { ProgressReportHighlight } from '../../dto/highlights.dto';
import { MediaCategory } from '../media-category.enum';

export type VariantGroup = IdOf<'ProgressReportMediaVariantGroup'>;

@RegisterResource({ db: e.ProgressReport.Media })
@InputType({ isAbstract: true })
@ObjectType()
export class ProgressReportMedia extends Resource {
  static Props = keysOf<ProgressReportMedia>();
  static SecuredProps = keysOf<SecuredProps<ProgressReportMedia>>();
  static BaseNodeProps = [...Resource.Props, 'category', 'creator', 'variant'];
  static readonly Parent = () =>
    import('../../dto/progress-report.entity').then((m) => m.ProgressReport);
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;

  static Variants = ProgressReportHighlight.Variants;
  // Only the last variant is publicly visible (accessible by anyone anonymously)
  // Saved in DB, so adjust with caution
  static PublicVariants = setOf(
    ProgressReportHighlight.Variants.slice(-1).map((v) => v.key),
  );

  readonly report: IdOf<ProgressReport>;

  @Field(() => Variant)
  readonly variant: Variant<MediaVariant> & SetDbType<MediaVariant>;

  @Field(() => MediaCategory, { nullable: true })
  readonly category?: MediaCategory | null;

  readonly media: IdOf<Media>;
  readonly file: FileId;

  @IdField()
  readonly variantGroup: VariantGroup;

  readonly creator: LinkTo<'User'>;
}

export type MediaVariant = VariantOf<typeof ProgressReportMedia>;

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReportMedia: typeof ProgressReportMedia;
  }
  interface ResourceDBMap {
    ProgressReportMedia: typeof e.ProgressReport.Media;
  }
}
