import { DbPermission } from './permission.model.db';

export class PropertyGrant<AnyBaseNode> {
  propertyName: keyof AnyBaseNode;
  permission: DbPermission;
  state?: (conditions: any) => boolean = () => true;
}
