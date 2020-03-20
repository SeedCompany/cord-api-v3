import { Module } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { OrganizationService } from '../organization';
import { UserModule } from '../user';
import { FileResolver } from './file.resolver';
import { FileService } from './file.service';
import { FilesBucketFactory } from './files-s3-bucket.factory';

@Module({
  imports: [UserModule],
  providers: [
    DatabaseService,
    FilesBucketFactory,
    FileResolver,
    FileService,
    OrganizationService,
  ],
  exports: [FileService],
})
export class FileModule {}
