import {
  Controller,
  forwardRef,
  Get,
  Inject,
  Param,
  Query,
  Response,
} from '@nestjs/common';
import { Response as IResponse } from 'express';
import { ID, LoggedInSession, Session } from '~/common';
import { FileService } from './file.service';

@Controller(FileUrlController.path)
export class FileUrlController {
  static path = '/file';

  constructor(
    @Inject(forwardRef(() => FileService))
    private readonly files: FileService
  ) {}

  @Get(':fileId/:fileName')
  async download(
    @Param('fileId') fileId: ID,
    @Query('proxy') proxy: string | undefined,
    @LoggedInSession() session: Session,
    @Response() res: IResponse
  ) {
    const node = await this.files.getFileNode(fileId, session);

    // TODO authorization using session

    const url = await this.files.getDownloadUrl(node);
    res.redirect(url);
  }
}
