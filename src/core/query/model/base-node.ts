import { Property } from './property';
import { SpecialProperty } from './specialProperty';

export interface BaseNode {
  label?: string;
  id?: string;
  createdAt?: string;
  owningOrgId?: string;
  props?: Property[];
  specialProps?: SpecialProperty[];
}
