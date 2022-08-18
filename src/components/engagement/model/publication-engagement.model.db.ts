import { DbBaseNodeLabel } from '../../../common';
import { DbEngagement } from './engagement.model.db';

export class DbPublicationEngagement extends DbEngagement {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.PublicationEngagement;
  language: any = null;
  publicationPlan: any = null;
}
