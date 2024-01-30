import { URL } from 'node:url';
import { posix } from 'path';

export const withAddedPath = (
  url: URL | string,
  ...pathSegments: string[]
): URL => {
  const next = new URL(String(url));
  next.pathname = posix.join(next.pathname, ...pathSegments);
  return next;
};

export const externalUrlWithProtocol = (url: string) => {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
};
