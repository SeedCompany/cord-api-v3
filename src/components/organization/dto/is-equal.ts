import { Address } from './address.dto';

export const isAddressEqual = (a: Address, b: Address) => {
  if (!a && !b) {
    // if both are falsy, then they are equal
    return true;
  } else if ((a && !b) || (b && !a)) {
    // if one is falsy and the other is not, then they aren't equal
    return false;
  } else {
    // otherwise, compare the properties
    return (
      a.addressOne === b.addressOne &&
      a.addressTwo === b.addressTwo &&
      a.city === b.city &&
      a.state === b.state &&
      a.zip === b.zip &&
      a.country === b.country
    );
  }
};
