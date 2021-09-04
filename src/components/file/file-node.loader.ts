import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { SingleItemLoader } from '../../core';
import { FileNode } from './dto';
import { FileService } from './file.service';

@Injectable({ scope: Scope.REQUEST })
export class FileNodeLoader extends SingleItemLoader<FileNode> {
  constructor(private readonly files: FileService) {
    super();
  }

  async loadOne(id: ID) {
    return await this.files.getFileNode(id, this.session);
  }
}
