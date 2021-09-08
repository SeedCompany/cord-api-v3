import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { FileNode } from './dto';
import { FileService } from './file.service';

@Injectable({ scope: Scope.REQUEST })
export class FileNodeLoader extends OrderedNestDataLoader<FileNode> {
  constructor(private readonly files: FileService) {
    super();
  }

  async loadMany(ids: ID[]) {
    return await this.files.getFileNodes(ids, this.session);
  }
}
