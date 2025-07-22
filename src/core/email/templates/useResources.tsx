import { useModuleRef } from '@seedcompany/nestjs-email/templates';
import { ResourceLoader } from '~/core/resources';

export const useResources = () => useModuleRef().get(ResourceLoader);
