import { DateTime } from 'luxon';
import { FileNodeCategory } from './category';
import { FileNodeType } from './type';

export type FileNode = File | Directory;

interface BaseNode {
  id: string;
  type: FileNodeType;
  category: FileNodeCategory;
  name: string;
  createdAt: DateTime | null;
  owner: unknown; // TODO User
  parents: ParentRef[];
}

export interface File extends BaseNode {
  type: FileNodeType.File;
  modifiedAt: DateTime | null;
  size: number;
  versions: FileVersion[];
}

export interface Directory extends BaseNode {
  type: FileNodeType.Directory;
  children: FileNode[];
}

export interface ParentRef {
  id: string;
  name: string;
  parentId: string | null;
}

export interface FileVersion {
  id: string;
  eTag: string;
  createdAt: DateTime;
}
