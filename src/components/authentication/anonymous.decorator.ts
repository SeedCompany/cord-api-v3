import { createMetadataDecorator } from '@seedcompany/nest';

export const LoggedIn = () => Anonymous(false);
export const Anonymous = createMetadataDecorator({
  setter: (anonymous = true) => anonymous,
  types: ['class', 'method'],
});
