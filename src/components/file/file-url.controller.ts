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
import { type ID } from '~/common';
import { AuthLevel, Identity } from '~/core/authentication';
import { HttpAdapter, type IRequest, type IResponse } from '~/core/http';
import { FileService } from './file.service';

@Controller(FileUrlController.path)
@AuthLevel('sessionless')
export class FileUrlController {
  static path = '/file';

  constructor(
    @Inject(forwardRef(() => FileService))
    private readonly files: FileService & {},
    private readonly identity: Identity,
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
      const session = await this.identity.identifyRequest(request);
      this.identity.verifyLoggedIn(session);
    }

    // TODO authorization using session

    const url = await this.files.getDownloadUrl(node, download != null);
    const cacheControl = this.files.determineCacheHeader(node);

    this.http.setHeader(res, 'Cache-Control', cacheControl);
    this.http.redirect(res, HttpStatus.FOUND, url);
  }
}
