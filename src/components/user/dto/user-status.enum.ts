import { ObjectType } from '@nestjs/graphql';
import {
  type EnumType,
  makeEnum,
  SecuredEnum,
  SecuredProperty,
} from '~/common';

export type UserStatus = EnumType<typeof UserStatus>;
export const UserStatus = makeEnum({
  name: 'UserStatus',
  values: ['Active', 'Disabled'],
});

/**
 * `nullable` because 92 migrated people have no recorded status — Neo4j only
 * ever wrote the Property when somebody set one. This changes the TypeScript
 * type only: the emitted `SecuredUserStatus.value` was already `UserStatus`
 * (nullable) either way, so `schema.graphql` does not move.
 */
@ObjectType({
  description: SecuredProperty.descriptionFor('a user status'),
})
export abstract class SecuredUserStatus extends SecuredEnum(UserStatus, {
  nullable: true,
}) {}
