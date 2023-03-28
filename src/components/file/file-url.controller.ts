import {
  Controller,
  forwardRef,
  Get,
  Inject,
  Param,
  Query,
  Request,
  Response,
} from '@nestjs/common';
import { Request as IRequest, Response as IResponse } from 'express';
import { ID } from '~/common';
import { loggedInSession as verifyLoggedIn } from '~/common/session';
import { SessionInterceptor } from '../authentication/session.interceptor';
import { FileService } from './file.service';

@Controller(FileUrlController.path)
export class FileUrlController {
  static path = '/file';

  constructor(
    @Inject(forwardRef(() => FileService))
    private readonly files: FileService,
    private readonly sessionHost: SessionInterceptor,
  ) {}

  @Get(':fileId/:fileName')
  async download(
    @Param('fileId') fileId: ID,
    @Query('proxy') proxy: string | undefined,
    @Request() request: IRequest,
    @Response() res: IResponse,
  ) {
    const node = await this.files.getFileNode(fileId);

    if (!node.public) {
      const session = await this.sessionHost.hydrateSession({ request });
      verifyLoggedIn(session);
    }

    // TODO authorization using session

    const url = await this.files.getDownloadUrl(node);
    res.redirect(url);
  }
}
