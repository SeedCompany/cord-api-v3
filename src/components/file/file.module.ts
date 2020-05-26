import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization';
import { UserModule } from '../user';
import { DirectoryResolver } from './directory.resolver';
import { FileVersionResolver } from './file-version.resolver';
import { FileResolver } from './file.resolver';
import { FileService } from './file.service';
import { FilesBucketFactory } from './files-s3-bucket.factory';

@Module({
  imports: [OrganizationModule, UserModule],
  providers: [
    DirectoryResolver,
    FilesBucketFactory,
    FileResolver,
    FileVersionResolver,
    FileService,
  ],
  exports: [FileService],
})
export class FileModule {}
