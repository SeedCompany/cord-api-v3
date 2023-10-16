import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { PaginatedList, PaginationInput } from '../../../common';
import { ProductMethodology } from './product-methodology.enum';

@InputType()
export class ProductCompletionDescriptionSuggestionsInput extends PaginationInput {
  @Field({
    nullable: true,
    description: 'A partial description to search for',
  })
  query?: string;

  @Field(() => ProductMethodology, {
    nullable: true,
    description:
      'Optionally limit suggestions to only ones for this methodology',
  })
  methodology?: ProductMethodology;
}

@ObjectType()
export abstract class ProductCompletionDescriptionSuggestionsOutput extends PaginatedList<
  // eslint-disable-next-line @typescript-eslint/ban-types
  String,
  string
>(String, {
  itemsDescription: PaginatedList.itemDescriptionFor('completion descriptions'),
}) {}
