import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { setOf } from '@seedcompany/common';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  IdField,
  type IdOf,
  Resource,
  type SecuredProps,
  Variant,
  type VariantOf,
} from '~/common';
import { type LinkTo } from '~/core';
import { type SetDbType } from '~/core/database';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { type FileId } from '../../../file/dto';
import { type Media } from '../../../file/media/media.dto';
import { type ProgressReport } from '../../dto';
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
    import('../../dto/progress-report.dto').then((m) => m.ProgressReport);
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
