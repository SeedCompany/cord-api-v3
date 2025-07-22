import { useConfig } from './useConfig';

export const useFrontendUrl = (path: string) => {
  path = path.startsWith('/') ? path.slice(1) : path;
  const config = useConfig();
  return new URL(path, config.frontendUrl).toString();
};
