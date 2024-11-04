import {
  Controller,
  forwardRef,
  Get,
  HttpStatus,
  Inject,
  Param,
  Query,
  Request,
  Response,
} from '@nestjs/common';
import { ID } from '~/common';
import { loggedInSession as verifyLoggedIn } from '~/common/session';
import { HttpAdapter, IRequest, IResponse } from '~/core/http';
import { SessionInterceptor } from '../authentication/session.interceptor';
import { FileService } from './file.service';

@Controller(FileUrlController.path)
export class FileUrlController {
  static path = '/file';

  constructor(
    @Inject(forwardRef(() => FileService))
    private readonly files: FileService & {},
    private readonly sessionHost: SessionInterceptor,
    private readonly http: HttpAdapter,
  ) {}

  @Get([':fileId', ':fileId/*'])
  async download(
    @Param('fileId') fileId: ID,
    @Query('download') download: '' | undefined,
    @Request() request: IRequest,
    @Response() res: IResponse,
  ) {
    const node = await this.files.getFileNode(fileId);

    if (!node.public) {
      const session = await this.sessionHost.hydrateSession({ request });
      verifyLoggedIn(session);
    }

    // TODO authorization using session

    const url = await this.files.getDownloadUrl(node, download != null);
    const cacheControl = this.files.determineCacheHeader(node);

    this.http.setHeader(res, 'Cache-Control', cacheControl);
    this.http.redirect(res, HttpStatus.FOUND, url);
  }
}
