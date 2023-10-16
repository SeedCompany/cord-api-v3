import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { FilterField, PaginatedList, SortablePaginationInput } from '~/common';
import { FileNodeType } from './file-node-type.enum';
import { Directory, File, FileNode, IFileNode } from './node';

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

@InputType()
export class FileListInput extends SortablePaginationInput<
  keyof File | keyof Directory
>({
  defaultSort: 'name',
}) {
  @FilterField(FileFilters)
  readonly filter?: FileFilters;
}

@ObjectType()
export class FileListOutput extends PaginatedList<IFileNode, FileNode>(
  IFileNode,
  {
    itemsDescription: PaginatedList.itemDescriptionFor('file nodes'),
  },
) {}
