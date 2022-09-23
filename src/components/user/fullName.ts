import { compact } from 'lodash';
import { User } from './dto';

export const fullName = (
  user: Partial<
    Pick<
      User,
      'realFirstName' | 'realLastName' | 'displayFirstName' | 'displayLastName'
    >
  >
) => {
  const realName = compact([
    user.realFirstName?.value ?? '',
    user.realLastName?.value ?? '',
  ]).join(' ');
  if (realName) {
    return realName;
  }
  const displayName = compact([
    user.displayFirstName?.value ?? '',
    user.displayLastName?.value ?? '',
  ]).join(' ');
  if (displayName) {
    return displayName;
  }

  return undefined;
};
