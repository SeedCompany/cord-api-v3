import { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { ServerException } from './exceptions';

const key = Symbol('AugmentedMetadata');
export const createAugmentedMetadataPipe = <
  T extends Record<string, any>
>() => {
  const pipe = (data: T | (() => T)): PipeTransform => ({
    transform: (value, metadata) => {
      const actual = typeof data === 'function' ? data() : data;
      if (!metadata.metatype) {
        throw new ServerException('Could not attach metadata');
      }
      // @ts-expect-error Yeah I didn't type it.
      metadata.metatype[key] = actual;
      return value;
    },
  });
  const get = (metadata: ArgumentMetadata): T => {
    // @ts-expect-error Yeah I didn't type it.
    const res = metadata.metatype?.[key];
    if (!res) {
      throw new ServerException('Could not find metadata');
    }
    return res;
  };

  return { attach: pipe, get };
};
