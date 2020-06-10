import { BaseNode } from './base-node';

export interface Property {
  key: string;
  value: any;
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
