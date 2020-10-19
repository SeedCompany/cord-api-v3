import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbEthnologueLanguage extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.EthnologueLanguage;
  code: any = null;
  name: any = null;
  population: any = null;
  provisionalCode: any = null;
}
