import { MailingAddress } from './mailing-address.dto';

export const isAddressEqual = (a: MailingAddress, b: MailingAddress) =>
  a.addressOne === b.addressOne &&
  a.addressTwo === b.addressTwo &&
  a.city === b.city &&
  a.state === b.state &&
  a.zip === b.zip &&
  a.country === b.country;
