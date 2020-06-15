import { BaseNode } from './base-node';

export interface AbstractProperty {
  key: string;
  isSingleton: boolean;
  oldValue?: any;
  labels?: string[];
  addToAdminSg?: boolean;
  addToReaderSg?: boolean;
  baseNode?: BaseNode;
  orderBy?: boolean;
  asc?: boolean;
  isPublicReadable?: boolean;
  isOrgReadable?: boolean;
}
