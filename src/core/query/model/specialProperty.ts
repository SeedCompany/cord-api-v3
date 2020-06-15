import { BaseNode } from './base-node';
import { Property } from './property';

export interface SpecialProperty extends Property {
  specialPropList: [[string, any]];
}
