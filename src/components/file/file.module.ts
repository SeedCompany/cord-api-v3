import { Module } from '@nestjs/common';
import { FileResolver } from './file.resolver';
import { FileService } from './file.service';
import { FilesBucketFactory } from './files-s3-bucket.factory';

@Module({
  providers: [FileResolver, FilesBucketFactory, FileService],
  exports: [FileService],
})
export class FileModule {}
