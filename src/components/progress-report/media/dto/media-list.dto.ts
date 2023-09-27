import { Field, InputType, ObjectType } from '@nestjs/graphql';
import {
  PaginatedList,
  SortablePaginationInput,
  Variant,
  VariantInputField,
} from '~/common';
import { ProgressReport } from '../../dto';
import { MediaVariant, ProgressReportMedia } from './media.dto';

@InputType()
export class ProgressReportMediaListInput extends SortablePaginationInput<
  'createdAt' | 'variant'
>({
  defaultSort: 'createdAt',
}) {
  @VariantInputField(ProgressReportMedia, {
    nullable: true,
    many: true,
    description: 'Filter to these specific variants',
  })
  variants?: ReadonlyArray<Variant<MediaVariant>>;
}

@ObjectType()
export class ProgressReportMediaList extends PaginatedList(
  ProgressReportMedia,
) {
  readonly report: ProgressReport;
}

@ObjectType()
export class AvailableProgressReportMediaVariant {
  @Field(() => Variant)
  readonly variant: Variant<MediaVariant>;

  @Field({
    description: 'Whether the user can upload/create media for this variant',
  })
  readonly canCreate: boolean;
}
