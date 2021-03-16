import { DbBaseNodeLabel } from '../../../../common';
import { DbBaseNode } from '../../../authorization/model/db-base-node.model';

export class DbProjectReport extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.ProjectReport;
  reportType: any = null;
  periodType: any = null;
  period: any = null;
  user: any = null;
  reportFile: any = null;
}
