import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DataObject,
  IdField,
  IdOf,
  IntersectionType as Merge,
  Resource,
  SecuredProps,
  Variant,
  VariantInputField,
  VariantOf,
} from '~/common';
import { SetDbType } from '~/core';
import { RegisterResource } from '~/core/resources';
import {
  CreateDefinedFileVersionInput,
  FileId,
  Media,
  MediaUserMetadata,
} from '../../file';
import { User } from '../../user';
import { ProgressReport } from '../dto';
import { ProgressReportHighlight } from '../dto/highlights.dto';
import { MediaCategory } from './media-category.enum';

export type VariantGroup = IdOf<'ProgressReportMediaVariantGroup'>;

@InputType({ isAbstract: true })
class HasCategory extends DataObject {
  @Field(() => MediaCategory, { nullable: true })
  readonly category?: MediaCategory | null;
}

@RegisterResource()
@ObjectType()
export class ProgressReportMedia extends Merge(Resource, HasCategory) {
  static Props = keysOf<ProgressReportMedia>();
  static SecuredProps = keysOf<SecuredProps<ProgressReportMedia>>();
  static readonly Parent = import('../dto/progress-report.entity').then(
    (m) => m.ProgressReport,
  );
  static Variants = ProgressReportHighlight.Variants;

  readonly report: IdOf<ProgressReport>;

  @Field(() => Variant)
  readonly variant: Variant<MediaVariant> & SetDbType<MediaVariant>;

  readonly media: IdOf<Media>;
  readonly file: FileId;

  @IdField()
  readonly variantGroup: VariantGroup;

  readonly creator: IdOf<User>;
}

export type MediaVariant = VariantOf<typeof ProgressReportMedia>;

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReportMedia: typeof ProgressReportMedia;
  }
}

@InputType()
export class UploadProgressReportMedia extends HasCategory {
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
  HasCategory,
  MediaUserMetadata,
) {
  @IdField()
  readonly id: IdOf<ProgressReportMedia>;
}
