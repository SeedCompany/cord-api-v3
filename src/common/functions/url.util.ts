import { posix } from 'node:path';
import { URL } from 'node:url';

export const withAddedPath = (
  url: URL | string,
  ...pathSegments: string[]
): URL => {
  const next = new URL(String(url));
  next.pathname = posix.join(next.pathname, ...pathSegments);
  return next;
};
