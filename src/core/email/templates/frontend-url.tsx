import { createContext, ReactElement, useContext } from 'react';
import { ServerException } from '../../../common/exceptions';

const FrontendUrlContext = createContext<string | undefined>(undefined);

export const useFrontendUrl = (path: string) => {
  const base = useContext(FrontendUrlContext);
  if (!base) {
    throw new ServerException('Frontend url has not been provided');
  }
  return base + path;
};

export const FrontendUrlWrapper = (url: string) => (el: ReactElement) =>
  <FrontendUrlContext.Provider value={url}>{el}</FrontendUrlContext.Provider>;
