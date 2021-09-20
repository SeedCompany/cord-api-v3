import { isPlainObject } from '@nestjs/common/utils/shared.utils';
import { mapValues } from 'lodash';

export const maskSecrets = (
  obj: Record<string, any>,
  depth = 3
): Record<string, any> =>
  mapValues(obj, (val, key) =>
    isSecret(key, val)
      ? maskSecret(val)
      : isPlainObject(val) && depth > 0
      ? maskSecrets(val, depth - 1)
      : val
  );

export const dropSecrets = (
  obj: Record<string, any>,
  depth = 3
): Record<string, any> =>
  mapValues(obj, (val, key) =>
    isSecret(key, val)
      ? undefined
      : isPlainObject(val) && depth > 0
      ? dropSecrets(val, depth - 1)
      : val
  );

const isSecret = (key: string, val: unknown): val is string =>
  typeof val === 'string' && /(password|token|key)/i.test(key);

const maskSecret = (val: string) =>
  `${'*'.repeat(Math.min(val.slice(0, -3).length, 20)) + val.slice(-3)}`;
