import { createMetadataDecorator } from '@seedcompany/nest';

export const AuthLevel = createMetadataDecorator({
  setter: (level: 'authenticated' | 'anonymous' | 'sessionless') => level,
  types: ['class', 'method'],
});
