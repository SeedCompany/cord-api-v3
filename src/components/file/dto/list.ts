import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
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
}

const defaultFilters = {};

@InputType()
export class FileListInput extends SortablePaginationInput<
  keyof File | keyof Directory
>({
  defaultSort: 'name',
}) {
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
