import { Sensitivity } from '../../../common';
import { DbPermission } from './permission.model.db';

export class PropertyGrant<AnyBaseNode> {
  propertyName: keyof AnyBaseNode;
  permission: DbPermission;
  state?: (conditions: any) => boolean = () => true;
}

export type SensitivePropertyGrant<T> = PropertyGrant<T> & {
  sensitivityLevel: Sensitivity;
};
