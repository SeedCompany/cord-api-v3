import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { UserModule } from '../user/user.module';
import { DirectoryResolver } from './directory.resolver';
import { FileVersionResolver } from './file-version.resolver';
import { FileRepository } from './file.repository';
import { FileResolver } from './file.resolver';
import { FileService } from './file.service';
import { FilesBucketFactory } from './files-s3-bucket.factory';

@Module({
  imports: [OrganizationModule, UserModule],
  providers: [
    DirectoryResolver,
    FilesBucketFactory,
    FileRepository,
    FileResolver,
    FileVersionResolver,
    FileService,
  ],
  exports: [FileService],
})
export class FileModule {}
