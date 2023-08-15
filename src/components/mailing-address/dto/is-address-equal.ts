import { MailingAddress } from './mailing-address.dto';

export const isAddressEqual = (
  addressInput?: MailingAddress,
  dbAddressObject?: MailingAddress,
) => {
  if (
    (!dbAddressObject || Object.keys(dbAddressObject).length === 0) &&
    (!addressInput || Object.entries(addressInput).length === 0)
  ) {
    return true;
  }

  if (
    dbAddressObject &&
    addressInput &&
    Object.entries(dbAddressObject).length ===
      Object.entries(addressInput).length
  ) {
    const addressChanges = Object.entries(addressInput).filter(([k, v]) => {
      const equalPropFound = Object.entries(dbAddressObject).find(
        ([objAddKey, objAddVal]) => objAddKey === k && objAddVal === v,
      );
      return equalPropFound ? false : true;
    });
    return !addressChanges?.length;
  } else {
    return false;
  }
};
