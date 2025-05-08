import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  OptionalField,
  PaginatedList,
  SortablePaginationInput,
} from '~/common';
import { FileNodeType } from './file-node-type.enum';
import {
  type Directory,
  type File,
  type FileNode,
  IFileNode,
} from './file.dto';

@InputType()
export abstract class FileFilters {
  @OptionalField({
    description: 'Only file nodes matching this name',
  })
  readonly name?: string;

  @OptionalField(() => FileNodeType, {
    description: 'Only file nodes matching this type',
  })
  readonly type?: FileNodeType;
}

@InputType()
export class FileListInput extends SortablePaginationInput<
  keyof File | keyof Directory
>({
  defaultSort: 'name',
}) {
  @FilterField(() => FileFilters)
  readonly filter?: FileFilters;
}

@ObjectType()
export class FileListOutput extends PaginatedList<IFileNode, FileNode>(
  IFileNode,
  {
    itemsDescription: PaginatedList.itemDescriptionFor('file nodes'),
  },
) {}
