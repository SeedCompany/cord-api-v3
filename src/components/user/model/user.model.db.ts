import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbUser extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.User;
  about: any = null;
  displayFirstName: any = null;
  displayLastName: any = null;
  email: any = null;
  phone: any = null;
  realFirstName: any = null;
  realLastName: any = null;
  roles: any = null;
  status: any = null;
  timezone: any = null;
  title: any = null;
  education: any = null;
  organization: any = null;
  partner: any = null;
  unavailability: any = null;
  locations: any = null;
  knownLanguage: any = null;
}
