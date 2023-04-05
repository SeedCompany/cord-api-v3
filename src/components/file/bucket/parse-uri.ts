export interface ParsedBucketUri {
  /**
   * The type or scheme. Case-insensitive and converted to lowercase.
   * Optional, so if omitted, it will be an empty string.
   */
  type: string;
  path: string;
  readonly: boolean;
}

export const parseUri = (uri: string): ParsedBucketUri => {
  const typeMatch = /^(?:(\w+)?:\/\/)?(.+)$/.exec(uri);
  if (!typeMatch) {
    // Shouldn't ever happen
    throw new Error('Failed to parse Bucket URI');
  }
  const [, type, remainingSrc] = typeMatch;
  const roMatch = /(:ro|:readonly)$/i.exec(remainingSrc);
  const readonly = !!roMatch;
  const path = roMatch
    ? remainingSrc.slice(0, -roMatch[0].length)
    : remainingSrc;
  return { type: type?.toLowerCase() ?? '', path, readonly };
};
