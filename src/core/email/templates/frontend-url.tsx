import * as React from 'react';
import { createContext, FC, useContext } from 'react';
import { ServerException } from '../../../common/exceptions';

const FrontendUrlContext = createContext<string | undefined>(undefined);

export const useFrontendUrl = (path: string) => {
  const base = useContext(FrontendUrlContext);
  if (!base) {
    throw new ServerException('Frontend url has not been provided');
  }
  return base + path;
};

export const FrontendUrlProvider: FC<{ url: string }> = ({ url, children }) => (
  <FrontendUrlContext.Provider value={url}>
    {children}
  </FrontendUrlContext.Provider>
);
