import { PropertyGrant } from './property-grant.model.db';

// a grant is an array of properties of a single type of base node

// eslint-disable-next-line @typescript-eslint/naming-convention
export class DbBaseNodeGrant<AnyBaseNode> {
  properties: Array<PropertyGrant<Partial<AnyBaseNode>>>;

  constructor(properties: Array<PropertyGrant<Partial<AnyBaseNode>>>) {
    this.properties = properties;
  }
}
