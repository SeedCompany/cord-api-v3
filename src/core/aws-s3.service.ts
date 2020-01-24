import { Injectable } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import { ConfigService } from './config/config.service';

export interface IS3ObjectResponse {
  AcceptRanges?: string;
  ContentLength?: number;
  ContentType?: string;
  ETag?: string;
  LastModified?: Date;
  Metadata?: {};
  VersionId?: string | null;
}

@Injectable()
export class AwsS3Service {
  private s3: S3;
  private bucket: string;
  private defaultExpires: number = 60 * 10;

  constructor(private awsS3: S3,
              private configService: ConfigService) {
    this.bucket = this.configService.files.bucket;
    this.s3 = this.awsS3;
  }

  async getSignedUrlForPutObject(metaData): Promise<string> {
    const { bucket = this.bucket, key, expires = this.defaultExpires } = metaData;

    return this.s3.getSignedUrlPromise('putObject', {
      Bucket: bucket,
      Expires: expires,
      Key: key,
    });
  }

  async getSignedUrlForGetObject(metaData): Promise<string> {
    const { bucket = this.bucket, key, expires = this.defaultExpires } = metaData;

    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: bucket,
      Expires: expires,
      Key: key,
    });
  }

  async getObject(options): Promise<IS3ObjectResponse> {
    const { bucket = this.bucket, key } = options;

    return this.s3.getObject({
      Bucket: bucket,
      Key: key,
    }).promise();
  }

  async moveObject(oldKey: string, newKey: string) {
    await this.s3.copyObject({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${oldKey}`,
      Key: newKey,
    }).promise();
    await this.s3.deleteObject({
      Bucket: this.bucket,
      Key: oldKey,
    }).promise();
  }
}
