import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnum, SecuredProperty } from '~/common';

export type UserStatus = EnumType<typeof UserStatus>;
export const UserStatus = makeEnum({
  name: 'UserStatus',
  values: ['Active', 'Disabled'],
});

@ObjectType({
  description: SecuredProperty.descriptionFor('a user status'),
})
export abstract class SecuredUserStatus extends SecuredEnum(UserStatus) {}
