import { PropertyGrant } from './property-grant.model.db';

// a grant is an array of properties of a single type of base node

export class DbBaseNodeGrant<AnyBaseNode> {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className: string;
  properties: Array<PropertyGrant<Partial<AnyBaseNode>>>;
  canList: boolean;

  constructor({
    ...rest
  }: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __className: string;
    canDelete: boolean;
    canList?: boolean;
    properties: Array<PropertyGrant<Partial<AnyBaseNode>>>;
  }) {
    Object.assign(this, rest);
  }
}
