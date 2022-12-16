import {
  Controller,
  Get,
  Headers,
  Inject,
  Put,
  Query,
  Request,
  Response,
} from '@nestjs/common';
import { Request as IRequest, Response as IResponse } from 'express';
import rawBody from 'raw-body';
import { InputException, ServerException } from '../../common';
import { FileBucket, LocalBucket } from './bucket';
import { FilesBucketToken } from './files-bucket.factory';

@Controller('/file')
export class LocalBucketController {
  private readonly bucket: LocalBucket | undefined;
  constructor(@Inject(FilesBucketToken) bucket: FileBucket) {
    this.bucket = bucket instanceof LocalBucket ? bucket : undefined;
  }

  @Put()
  async upload(
    @Headers('content-type') contentType: string,
    @Query('signed') signed: string,
    @Request() req: IRequest
  ) {
    if (!this.bucket) {
      throw new ServerException('Cannot upload file here');
    }
    // Chokes on json files because they are parsed with body-parser.
    // Need to disable it for this path or create a workaround.
    const contents = await rawBody(req);
    if (!contents) {
      throw new InputException();
    }

    await this.bucket.upload(signed, {
      Body: contents,
      ContentType: contentType,
    });
    return { ok: true };
  }

  @Get()
  async download(@Query('signed') signed: string, @Response() res: IResponse) {
    if (!this.bucket) {
      throw new ServerException('Cannot download file here');
    }

    const out = await this.bucket.download(signed);
    res.setHeader('Content-Type', out.ContentType!);
    out.Body.pipe(res);
  }
}
