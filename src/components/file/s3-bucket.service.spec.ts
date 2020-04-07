import { Test, TestingModule } from '@nestjs/testing';
import { GetObjectOutput } from 'aws-sdk/clients/s3';
import { CoreModule, LoggerModule } from '../../core';
import { AuthModule } from '../auth/auth.module';
import { OrganizationModule } from '../organization';
import { UnavailabilityModule, UserModule } from '../user';
import { FileModule } from './file.module';
import {
  FilesBucketFactory,
  FilesBucketToken,
} from './files-s3-bucket.factory';
import { S3Bucket } from './s3-bucket';

const mockPreSignedUrl =
  'https://cord-field-files-olive.s3.ap-south-1.amazonaws.com/temp/LcrIf9dG?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAZSJR72XKUBVH6RZA%2F20200311%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Date=20200311T123521Z&X-Amz-Expires=900&X-Amz-Signature=b3e7efad9b105c616476b83b4d20b594057d95e8d4edc574440c0086935c7461&X-Amz-SignedHeaders=host';
describe('S3 Bucket', () => {
  let bucket: S3Bucket;
  const mockS3 = {
    getSignedUrl: () => Promise.resolve(mockPreSignedUrl),
    getObject: (): Promise<Partial<GetObjectOutput>> =>
      Promise.resolve({
        ContentLength: 1234,
        ContentType: 'plain/text',
      }),
    moveObject: () => Promise.resolve({}),
    copyObject: () => Promise.resolve({}),
    deleteObject: () => Promise.resolve({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        FileModule,
        LoggerModule.forRoot(),
        UserModule,
        CoreModule,
        OrganizationModule,
        UnavailabilityModule,
        AuthModule,
      ],
      providers: [FilesBucketFactory],
    }).compile();

    bucket = module.get(FilesBucketToken);
  });

  it('should have presigned url for put object', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    bucket.getSignedUrlForPutObject = jest
      .fn()
      .mockReturnValue(mockS3.getSignedUrl());
    const preSignedUrl = await bucket.getSignedUrlForPutObject('testkey');
    expect(preSignedUrl).toBe(mockPreSignedUrl);
  });

  it('should return a mock object', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    bucket.getObject = jest.fn().mockReturnValue(mockS3.getObject());
    const mockObject = await bucket.getObject('testkey');
    expect(mockObject.ContentLength).toBe(
      (await mockS3.getObject()).ContentLength
    );
    expect(mockObject.ContentType).toBe((await mockS3.getObject()).ContentType);
  });
});
