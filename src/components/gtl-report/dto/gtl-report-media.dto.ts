import { Field, InputType, ObjectType } from '@nestjs/graphql';
import {
  type ID,
  IdField,
  Resource,
  SecuredEnum,
  SecuredStringNullable,
  type Sensitivity,
} from '~/common';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { CreateDefinedFileVersion, type FileId } from '../../file/dto';
import { type Media } from '../../file/media/media.dto';
import { MediaCategory } from '../../progress-report/media/media-category.enum';

// Declared above `GtlReportMedia`: a class used in a decorator's type thunk
// is evaluated at class-definition time, so a later declaration is a TDZ crash
// at boot, not a lint nit.
@ObjectType({
  description: SecuredEnum.descriptionFor('a media category'),
})
export abstract class SecuredMediaCategory extends SecuredEnum(MediaCategory, {
  nullable: true,
}) {}

/**
 * A photo, video or audio clip attached to a GTL quarterly report.
 *
 * Momentum's `ProgressReportMedia` is keyed by (variantGroup, variant) because
 * a highlight is one image re-cut for four audiences. Nothing re-cuts a GTL
 * upload — a leader photographs a workshop and captions it — so this is a flat
 * list. The category vocabulary is shared with Momentum on purpose: same set of
 * subjects, and the investor portal reads both.
 */
@RegisterResource()
@ObjectType({ implements: [Resource] })
export class GtlReportMedia extends Resource {
  static readonly Parent = () =>
    import('./gtl-report.dto').then((m) => m.GTLReport);
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;

  readonly report: LinkTo<'GTLReport'>;

  @Field(() => SecuredMediaCategory)
  readonly category: SecuredMediaCategory;

  @Field()
  readonly caption: SecuredStringNullable;

  readonly media: ID<Media> | null;
  readonly file: FileId | null;

  readonly creator: LinkTo<'User'>;

  readonly sensitivity: Sensitivity;
}

@InputType()
export class UploadGtlReportMedia {
  @IdField()
  readonly report: ID<'GTLReport'>;

  @Field()
  readonly file: CreateDefinedFileVersion;

  @Field(() => MediaCategory, { nullable: true })
  readonly category?: MediaCategory | null;

  @Field(() => String, { nullable: true })
  readonly caption?: string | null;
}

@InputType()
export class UpdateGtlReportMedia {
  @IdField()
  readonly id: ID<'GtlReportMedia'>;

  @Field(() => MediaCategory, { nullable: true })
  readonly category?: MediaCategory | null;

  @Field(() => String, { nullable: true })
  readonly caption?: string | null;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    GtlReportMedia: typeof GtlReportMedia;
  }
}
