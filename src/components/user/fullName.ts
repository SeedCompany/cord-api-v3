import { cleanJoin } from '@seedcompany/common';
import { type User } from './dto';

export const fullName = (
  user: Partial<
    Pick<
      User,
      'realFirstName' | 'realLastName' | 'displayFirstName' | 'displayLastName'
    >
  >,
) => {
  const displayName = cleanJoin(' ', [
    user.displayFirstName?.value,
    user.displayLastName?.value,
  ]);
  if (displayName) {
    return displayName;
  }
  const realName = cleanJoin(' ', [
    user.realFirstName?.value,
    user.realLastName?.value,
  ]);
  if (realName) {
    return realName;
  }

  return undefined;
};

export const displayFullName = (
  user: Partial<Pick<User, 'displayFirstName' | 'displayLastName'>>,
) =>
  cleanJoin(' ', [user.displayFirstName?.value, user.displayLastName?.value]) ||
  undefined;
