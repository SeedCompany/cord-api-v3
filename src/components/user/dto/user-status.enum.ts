import { registerEnumType } from '@nestjs/graphql';

export enum UserStatus {
  Active = 'Active',
  Disabled = 'Disabled',
}

registerEnumType(UserStatus, {
  name: 'UserStatus',
});
