import { posix } from 'path';

export const withAddedPath = (
  url: URL | string,
  ...pathSegments: string[]
): URL => {
  const next = new URL(url);
  next.pathname = posix.join(next.pathname, ...pathSegments);
  return next;
};
