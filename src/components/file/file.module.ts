import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { DirectoryResolver } from './directory.resolver';
import { FileNodeLoader } from './file-node.loader';
import { FileNodeResolver } from './file-node.resolver';
import { FileVersionResolver } from './file-version.resolver';
import { FileRepository } from './file.repository';
import { FileResolver } from './file.resolver';
import { FileService } from './file.service';
import { FilesBucketFactory } from './files-bucket.factory';
import * as handlers from './handlers';
import { LocalBucketController } from './local-bucket.controller';
import * as migrations from './migrations';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [
    DirectoryResolver,
    FilesBucketFactory,
    FileNodeResolver,
    FileRepository,
    FileResolver,
    FileVersionResolver,
    FileNodeLoader,
    FileService,
    ...Object.values(handlers),
    ...Object.values(migrations),
  ],
  controllers: [LocalBucketController],
  exports: [FileService],
})
export class FileModule {}
