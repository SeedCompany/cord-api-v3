import * as React from 'react';
import { createContext, FC, useContext } from 'react';

const RenderForTextContext = createContext(false);

/**
 * Hook for whether we are rendering for text.
 */
export const inText = () => useContext(RenderForTextContext);

/**
 * Hide the children of this element when converting to text.
 */
export const HideInText: FC = ({ children }) =>
  inText() ? null : <>{children}</>;

/**
 * Only show the children of this element when converting to text.
 */
export const InText: FC = ({ children }) => (inText() ? <>{children}</> : null);

export const RenderForText: FC<{ value?: boolean }> = ({ value, children }) => (
  <RenderForTextContext.Provider value={value ?? true}>
    {children}
  </RenderForTextContext.Provider>
);
