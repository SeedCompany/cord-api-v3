import {
  Controller,
  Get,
  Headers,
  Put,
  Request,
  Response,
} from '@nestjs/common';
import { Request as IRequest, Response as IResponse } from 'express';
import { DateTime } from 'luxon';
import { URL } from 'node:url';
import rawBody from 'raw-body';
import { InputException } from '~/common';
import { FileBucket, InvalidSignedUrlException } from './bucket';

/**
 * This fakes S3 web hosting for use with LocalBuckets.
 */
@Controller(LocalBucketController.path)
export class LocalBucketController {
  static path = '/local-bucket';

  constructor(private readonly bucket: FileBucket) {}

  @Put()
  async upload(
    @Headers('content-type') contentType: string,
    @Request() req: IRequest,
  ) {
    // Chokes on json files because they are parsed with body-parser.
    // Need to disable it for this path or create a workaround.
    const contents = await rawBody(req);
    if (!contents) {
      throw new InputException();
    }

    const url = new URL(`https://localhost${req.url}`);
    const parsed = await this.bucket.parseSignedUrl(url);
    if (parsed.operation !== 'PutObject') {
      throw new InvalidSignedUrlException();
    }
    await this.bucket.putObject({
      Key: parsed.Key,
      Body: contents,
      ContentType: contentType,
    });

    return { ok: true };
  }

  @Get()
  async download(@Request() req: IRequest, @Response() res: IResponse) {
    const url = new URL(`https://localhost${req.url}`);
    const { Key, operation, ...rest } = await this.bucket.parseSignedUrl(url);
    if (operation !== 'GetObject') {
      throw new InvalidSignedUrlException();
    }
    const signedParams = Object.fromEntries(
      Object.entries(rest).flatMap(([k, v]) =>
        v != null ? [[k.replace(/^Response/, ''), v]] : [],
      ),
    );
    const bucketObject = await this.bucket.getObject(Key);
    const out = { ...bucketObject, ...signedParams };

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
