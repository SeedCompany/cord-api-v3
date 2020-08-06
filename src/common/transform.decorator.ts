import { Transform as T } from 'class-transformer';
import { TransformOptions } from 'class-transformer/metadata/ExposeExcludeOptions';
import { TransformationType } from 'class-transformer/TransformOperationExecutor';

export const Transform = T as (
  transformFn: (
    value: any,
    obj: any,
    transformationType: TransformationType
  ) => any,
  options?: TransformOptions
) => PropertyDecorator;
