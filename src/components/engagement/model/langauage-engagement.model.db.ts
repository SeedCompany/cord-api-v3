import { DbBaseNodeLabel } from '../../../common';
import { DbEngagement } from './engagement.model.db';

export class DbLanguageEngagement extends DbEngagement {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.LanguageEngagement;
  firstScripture: any = null;
  language: any = null;
  lukePartnership: any = null;
  openToInvestorVisit: any = null;
  paratextRegistryId: any = null;
  pnp: any = null;
  sentPrintingDate: any = null;
  product: any = null;
  historicGoal: any = null;
}
