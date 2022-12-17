import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { DirectoryResolver } from './directory.resolver';
import { FileNodeLoader } from './file-node.loader';
import { FileNodeResolver } from './file-node.resolver';
import { FileUrlController } from './file-url.controller';
import { FileVersionResolver } from './file-version.resolver';
import { FileRepository } from './file.repository';
import { FileResolver } from './file.resolver';
import { FileService } from './file.service';
import { FilesBucketFactory } from './files-bucket.factory';
import * as handlers from './handlers';
import { LocalBucketController } from './local-bucket.controller';

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
  ],
  controllers: [FileUrlController, LocalBucketController],
  exports: [FileService],
})
export class FileModule {}
