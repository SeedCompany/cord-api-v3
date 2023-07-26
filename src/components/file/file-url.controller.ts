import {
  Controller,
  forwardRef,
  Get,
  HttpStatus,
  Inject,
  Param,
  Request,
  Response,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request as IRequest } from 'express';
import { ID } from '~/common';
import { loggedInSession as verifyLoggedIn } from '~/common/session';
import { SessionInterceptor } from '../authentication/session.interceptor';
import { FileService } from './file.service';

@Controller(FileUrlController.path)
export class FileUrlController {
  static path = '/file';

  constructor(
    @Inject(forwardRef(() => FileService))
    private readonly files: FileService & {},
    private readonly sessionHost: SessionInterceptor,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  @Get(':fileId/:fileName?')
  async download(
    @Param('fileId') fileId: ID,
    @Request() request: IRequest,
    @Response() res: unknown,
  ) {
    const node = await this.files.getFileNode(fileId);

    if (!node.public) {
      const session = await this.sessionHost.hydrateSession({ request });
      verifyLoggedIn(session);
    }

    // TODO authorization using session

    const url = await this.files.getDownloadUrl(node);
    const cacheControl = this.files.determineCacheHeader(node);

    const { httpAdapter } = this.httpAdapterHost;
    httpAdapter.setHeader(res, 'Cache-Control', cacheControl);
    httpAdapter.redirect(res, HttpStatus.FOUND, url);
  }
}
