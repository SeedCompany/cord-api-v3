import { InputType, ObjectType } from '@nestjs/graphql';
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
