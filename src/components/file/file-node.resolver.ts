import { Resolver } from '@nestjs/graphql';
import { Class } from 'type-fest';
import { FileNodeType } from './dto';
import { FileService } from './file.service';

export function FileNodeResolver<T>(
  type: FileNodeType,
  concreteClass: Class<T>
) {
  @Resolver(concreteClass)
  class FileNodeResolver {
    constructor(protected readonly service: FileService) {}
  }
  return FileNodeResolver;
}
