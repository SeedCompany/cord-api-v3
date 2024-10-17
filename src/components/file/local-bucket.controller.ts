import {
  Body,
  Controller,
  Get,
  Headers,
  Put,
  Request,
  Response,
  StreamableFile,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { URL } from 'node:url';
import { InputException } from '~/common';
import { HttpAdapter, IRequest, IResponse, RawBody } from '~/core/http';
import { FileBucket, InvalidSignedUrlException } from './bucket';

/**
 * This fakes S3 web hosting for use with LocalBuckets.
 */
@Controller(LocalBucketController.path)
export class LocalBucketController {
  static path = '/local-bucket';

  constructor(
    private readonly bucket: FileBucket,
    private readonly http: HttpAdapter,
  ) {}

  @Put()
  @RawBody({ passthrough: true })
  async upload(
    @Headers('content-type') contentType: string,
    @Request() req: IRequest,
    @Body() contents: Buffer,
  ) {
    if (!contents || !Buffer.isBuffer(contents)) {
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
  async download(
    @Request() req: IRequest,
    @Response({ passthrough: true }) res: IResponse,
  ) {
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
      'Content-Length': String(out.ContentLength),
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
        this.http.setHeader(res, header, val);
      }
    }

    return new StreamableFile(out.Body);
  }
}
