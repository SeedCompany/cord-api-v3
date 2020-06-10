import { Property } from './property';

export interface BaseNode {
  label: string;
  id: string;
  createdAt: string;
  owningOrgId?: string;
  props: Property[];
}
