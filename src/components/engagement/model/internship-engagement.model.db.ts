import { DbBaseNodeLabel } from '../../../common';
import { DbEngagement } from './engagement.model.db';

export class DbInternshipEngagement extends DbEngagement {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.InternshipEngagement;
  countryOfOrigin: any = null;
  growthPlan: any = null;
  intern: any = null;
  mentor: any = null;
  methodologies: any = null;
  position: any = null;
}
