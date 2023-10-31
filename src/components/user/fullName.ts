import { cleanJoin } from '@seedcompany/common';
import { User } from './dto';

export const fullName = (
  user: Partial<
    Pick<
      User,
      'realFirstName' | 'realLastName' | 'displayFirstName' | 'displayLastName'
    >
  >,
) => {
  const realName = cleanJoin(' ', [
    user.realFirstName?.value,
    user.realLastName?.value,
  ]);
  if (realName) {
    return realName;
  }
  const displayName = cleanJoin(' ', [
    user.displayFirstName?.value,
    user.displayLastName?.value,
  ]);
  if (displayName) {
    return displayName;
  }

  return undefined;
};
