import { createContext, type ReactElement, useContext } from 'react';
import { ServerException } from '~/common/exceptions';

const FrontendUrlContext = createContext<Readonly<URL> | undefined>(undefined);

export const useFrontendUrl = (path: string) => {
  const base = useContext(FrontendUrlContext);
  if (!base) {
    throw new ServerException('Frontend url has not been provided');
  }
  path = path.startsWith('/') ? path.slice(1) : path;
  return new URL(path, base).toString();
};

export const FrontendUrlWrapper = (url: Readonly<URL>) => (el: ReactElement) =>
  <FrontendUrlContext.Provider value={url}>{el}</FrontendUrlContext.Provider>;
