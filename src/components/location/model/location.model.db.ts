import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbLocation extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.Location;
  name: any = null;
  type: any = null;
  isoAlpha3: any = null;
  fundingAccount: any = null;
  defaultFieldRegion: any = null;
  sensitivity: any = null;
  communicationRegions: any = null;
}
