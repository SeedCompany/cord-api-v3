import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { DirectoryResolver } from './directory.resolver';
import { FileNodeLoader } from './file-node.loader';
import { FileNodeResolver } from './file-node.resolver';
import { FileUrlController } from './file-url.controller';
import { FileVersionResolver } from './file-version.resolver';
import { FileDrizzleRepository } from './file.drizzle.repository';
import { FileRepository } from './file.repository';
import { FileResolver } from './file.resolver';
import { FileService } from './file.service';
import { FilesBucketFactory } from './files-bucket.factory';
import * as handlers from './handlers';
import { LocalBucketController } from './local-bucket.controller';
import { MediaUrlResolver } from './media-url.resolver';
import { MediaModule } from './media/media.module';

@Module({
  imports: [forwardRef(() => AuthorizationModule), MediaModule],
  providers: [
    DirectoryResolver,
    FilesBucketFactory,
    FileNodeResolver,
    // migration-todo: drop the `as any` + the Neo4j path at Phase 7 cutover.
    splitDb(FileRepository, {
      postgres: FileDrizzleRepository as any,
    }),
    FileResolver,
    FileVersionResolver,
    MediaUrlResolver,
    FileNodeLoader,
    FileService,
    ...Object.values(handlers),
  ],
  controllers: [FileUrlController, LocalBucketController],
  exports: [FileService, MediaModule],
})
export class FileModule {}
