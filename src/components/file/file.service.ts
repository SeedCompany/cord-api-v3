import { Inject, Injectable } from '@nestjs/common';
import { FilesBucketToken } from './files-s3-bucket.factory';
import { S3Bucket } from './s3-bucket';

@Injectable()
export class FileService {
  constructor(@Inject(FilesBucketToken) private readonly bucket: S3Bucket) {}
}
