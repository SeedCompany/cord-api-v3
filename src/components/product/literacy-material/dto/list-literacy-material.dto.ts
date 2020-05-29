import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { LiteracyMaterial } from './literacy-material';

@InputType()
export abstract class LiteracyMaterialFilters {
  @Field({
    description: 'Only literacy material matching this name',
    nullable: true,
  })
  readonly name?: string;
}

const defaultFilters = {};

@InputType()
export class LiteracyMaterialListInput extends SortablePaginationInput<
  keyof LiteracyMaterial
>({
  defaultSort: 'name',
}) {
  static defaultVal = new LiteracyMaterialListInput();

  @Field({ nullable: true })
  @Type(() => LiteracyMaterialFilters)
  @ValidateNested()
  readonly filter: LiteracyMaterialFilters = defaultFilters;
}

@ObjectType()
export class LiteracyMaterialListOutput extends PaginatedList(
  LiteracyMaterial
) {}

@ObjectType({
  description: SecuredList.descriptionFor('literacyMaterials'),
})
export abstract class SecuredLiteracyMaterialList extends SecuredList(
  LiteracyMaterial
) {}
