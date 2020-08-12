import { InputType, ObjectType } from '@nestjs/graphql';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { RegistryOfGeography } from './registry-of-geography.dto';

@InputType()
export class RegistryOfGeographyListInput extends SortablePaginationInput<
  keyof RegistryOfGeography
>({
  defaultSort: 'name',
}) {
  static defaultVal = new RegistryOfGeographyListInput();
}

@ObjectType()
export class RegistryOfGeographyListOutput extends PaginatedList(
  RegistryOfGeography
) {}
