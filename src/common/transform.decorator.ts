import { Transform as T } from 'class-transformer';

export const Transform = T as (...args: Parameters<typeof T>) => PropertyDecorator;
