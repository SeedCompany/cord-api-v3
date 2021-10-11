import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbProduct extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.Product;
  mediums: any = null;
  methodology: any = null;
  purposes: any = null;
  steps: any = null;
  scriptureReferences: any = null;
  produces: any = null;
  scriptureReferencesOverride: any = null;
  isOverriding: any = null;
  describeCompletion: any = null;
  progressStepMeasurement: any = null;
  progressTarget: any = null;
  title: any = null;
  description: any = null;
  unspecifiedScripture: any = null;
}
