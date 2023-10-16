import { EnumType, makeEnum } from '~/common';

export type UserStatus = EnumType<typeof UserStatus>;
export const UserStatus = makeEnum({
  name: 'UserStatus',
  values: ['Active', 'Disabled'],
});
