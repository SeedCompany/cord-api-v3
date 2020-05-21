import { Property } from './property';

export interface BaseNode {
  label: string;
  id: string;
  createdAt: string;
  props: Property[];
}
