import { useModuleRef } from '@seedcompany/nestjs-email/templates';
import type { ConfigService } from '~/core';

export const useConfig = () =>
  useModuleRef().get<ConfigService>('CONFIG', { strict: false });
