import { Module } from '@nestjs/common';
import { FileResolver } from './file.resolver';
import { FileService } from './file.service';
import { FilesBucketFactory } from './files-s3-bucket.factory';
import { UserService } from '../user';
import { OrganizationService } from '../organization';
import { AuthService } from '../auth';

@Module({
  providers: [AuthService, FileResolver, FilesBucketFactory, FileService, UserService, OrganizationService],
  exports: [FileService],
})
export class FileModule {}
