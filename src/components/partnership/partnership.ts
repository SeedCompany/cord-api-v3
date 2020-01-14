import { DateTime } from 'luxon';
import { Organization } from '../organization/organization';
import { PartnershipAgreementStatus } from './agreement-status';
import { PartnershipType } from './partnership-type';

export class Partnership {
  
}

export interface Partnership {
  agreementStatus: PartnershipAgreementStatus;
  mouStatus: PartnershipAgreementStatus;
  mouStart: DateTime | null;
  mouEnd: DateTime | null;
  organization: Organization;
  types: PartnershipType[];
}
