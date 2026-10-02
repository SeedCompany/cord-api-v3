import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { setOf } from '@seedcompany/common';
import { type ID, IdField, Resource, Variant, type VariantOf } from '~/common';
import { type SetDbType } from '~/core/database';
import { RegisterResource } from '~/core/resources';
import { type LinkTo } from '~/core/resources';
import { type FileId } from '../../../file/dto';
import { type Media } from '../../../file/media/media.dto';
import { ProgressReportHighlight } from '../../dto/highlights.dto';
import { MediaCategory } from '../media-category.enum';

export type VariantGroup = ID<'ProgressReportMediaVariantGroup'>;

/**
 * The reports media can hang off: the engagement-parented kinds. One resource
 * serves both, so the id is typed by the union rather than by `ProgressReport`.
 */
export type MediaReportId = ID<'ProgressReport' | 'GTLReport'>;

/**
 * Media (image/video/audio) on an engagement report. Despite the name this is
 * the ONE media resource for both `ProgressReport` and `GTLReport`: the same
 * table, variants, variant groups and grants serve both report kinds.
 */
@RegisterResource()
@InputType({ isAbstract: true })
@ObjectType()
export class ProgressReportMedia extends Resource {
  static readonly Parent = () =>
    import('../../dto/progress-report.dto').then((m) => m.ProgressReport);
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;

  static Variants = ProgressReportHighlight.Variants;
  // Only the last variant is publicly visible (accessible by anyone anonymously)
  // Saved in DB, so adjust with caution
  static PublicVariants = setOf(
    ProgressReportHighlight.Variants.slice(-1).map((v) => v.key),
  );

  readonly report: MediaReportId;

  @Field(() => Variant)
  readonly variant: Variant<MediaVariant> & SetDbType<MediaVariant>;

  @Field(() => MediaCategory, { nullable: true })
  readonly category?: MediaCategory | null;

  readonly media: ID<Media>;
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
}
