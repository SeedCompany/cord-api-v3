import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { FileNodeCategory } from './category';
import { Directory, File, FileNode, IFileNode } from './node';
import { FileNodeType } from './type';

@InputType()
export abstract class FileFilters {
  @Field({
    description: 'Only file nodes matching this name',
    nullable: true,
  })
  readonly name?: string;

  @Field(() => FileNodeType, {
    description: 'Only file nodes matching this type',
    nullable: true,
  })
  readonly type?: FileNodeType;

  @Field(() => [FileNodeCategory], {
    description: 'Only file nodes matching these categories',
    nullable: true,
  })
  readonly category?: readonly FileNodeCategory[];
}

const defaultFilters = {};

@InputType()
export class FileListInput extends SortablePaginationInput<
  keyof File | keyof Directory
>({
  defaultSort: 'name',
}) {
  static defaultVal = new FileListInput();

  @Field({ nullable: true })
  @Type(() => FileFilters)
  @ValidateNested()
  readonly filter?: FileFilters = defaultFilters;
}

@ObjectType()
export class FileListOutput extends PaginatedList<IFileNode, FileNode>(
  IFileNode,
  {
    itemsDescription: PaginatedList.itemDescriptionFor('file nodes'),
  }
) {}
