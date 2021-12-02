import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbLanguage extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.Language;
  displayName: any = null;
  displayNamePronunciation: any = null;
  isDialect: any = null;
  isSignLanguage: any = null;
  leastOfThese: any = null;
  leastOfTheseReason: any = null;
  name: any = null;
  populationOverride: any = null;
  registryOfDialectsCode: any = null;
  signLanguageCode: any = null;
  sponsorEstimatedEndDate: any = null;
  ethnologue: any = null;
  sensitivity: any = null;
  hasExternalFirstScripture: any = null;
  locations: any = null;
  tags: any = null;
  presetInventory: any = null;
  posts: any = null;
}
