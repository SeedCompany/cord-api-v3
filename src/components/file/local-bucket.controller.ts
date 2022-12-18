import {
  Controller,
  Get,
  Headers,
  Put,
  Query,
  Request,
  Response,
} from '@nestjs/common';
import { Request as IRequest, Response as IResponse } from 'express';
import { DateTime } from 'luxon';
import rawBody from 'raw-body';
import { InputException, ServerException } from '../../common';
import { FileBucket, LocalBucket } from './bucket';

@Controller(LocalBucketController.path)
export class LocalBucketController {
  static path = '/local-bucket';

  private readonly bucket: LocalBucket | undefined;
  constructor(bucket: FileBucket) {
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

    const headers = {
      'Cache-Control': out.CacheControl,
      'Content-Disposition': out.ContentDisposition,
      'Content-Encoding': out.ContentEncoding,
      'Content-Language': out.ContentLanguage,
      'Content-Length': out.ContentLength,
      'Content-Type': out.ContentType,
      Expires: out.Expires
        ? DateTime.fromJSDate(out.Expires).toHTTP()
        : undefined,
      ETag: out.ETag,
      LastModified: out.LastModified
        ? DateTime.fromJSDate(out.LastModified).toHTTP()
        : undefined,
    };
    for (const [header, val] of Object.entries(headers)) {
      if (val != null) {
        res.setHeader(header, val);
      }
    }

    out.Body.pipe(res);
  }
}
