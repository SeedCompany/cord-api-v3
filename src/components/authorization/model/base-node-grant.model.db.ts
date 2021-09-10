import { Sensitivity } from '../../../common';
import { PropertyGrant } from './property-grant.model.db';

// a grant is an array of properties of a single type of base node

export class DbBaseNodeGrant<AnyBaseNode> {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className: string;
  properties: Array<PropertyGrant<Partial<AnyBaseNode>>>;
  canList: boolean;
  sensitivityAccess: Sensitivity = Sensitivity.High;

  constructor(props: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __className: string;
    canDelete: boolean;
    canList?: boolean;
    sensitivityAccess?: Sensitivity;
    properties: Array<PropertyGrant<Partial<AnyBaseNode>>>;
  }) {
    Object.assign(this, props);
  }
}
