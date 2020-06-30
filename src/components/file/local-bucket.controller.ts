import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Inject,
  InternalServerErrorException,
  Put,
  Query,
  Request,
  Response,
  UseFilters,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request as IRequest, Response as IResponse } from 'express';
import * as rawBody from 'raw-body';
import { FileBucket, LocalBucket } from './bucket';
import { FilesBucketToken } from './files-bucket.factory';

@Controller('/file')
@UseFilters(BaseExceptionFilter)
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
      throw new InternalServerErrorException('Cannot upload file here');
    }
    // Chokes on json files because they are parsed with body-parser.
    // Need to disable it for this path or create a workaround.
    const contents = (await rawBody(req)).toString('utf8').trim();
    if (!contents) {
      throw new BadRequestException();
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
      throw new InternalServerErrorException('Cannot download file here');
    }

    const out = await this.bucket.download(signed);
    res.setHeader('Content-Type', out.ContentType!);
    res.send(out.Body);
  }
}
