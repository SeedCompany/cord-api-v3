import { useModuleRef } from '@seedcompany/nestjs-email/templates';
import { ConfigService } from '~/core/config/config.service';

export const useFrontendUrl = (path: string) => {
  path = path.startsWith('/') ? path.slice(1) : path;
  const config = useModuleRef().get(ConfigService);
  return new URL(path, config.frontendUrl).toString();
};
