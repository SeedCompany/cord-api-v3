import { type Type } from '@nestjs/common';
import { type Command } from '@smithy/smithy-client';
import { FileBucket, type SignedOp } from './file-bucket';

export class ReadonlyBucket extends FileBucket {
  constructor(private readonly source: FileBucket) {
    super();
  }

  get isReadonly() {
    return true;
  }

  async getSignedUrl<TCommandInput extends object>(
    operation: Type<Command<TCommandInput, any, any>>,
    input: SignedOp<TCommandInput>,
  ) {
    return await this.source.getSignedUrl(operation, input);
  }

  async parseSignedUrl(url: URL) {
    return await this.source.parseSignedUrl(url);
  }

  async getObject(key: string) {
    return await this.source.getObject(key);
  }

  async headObject(key: string) {
    return await this.source.headObject(key);
  }

  async putObject(_input: unknown) {
    throw new Error('File bucket is readonly and cannot put objects');
  }

  async copyObject(_oldKey: string, _newKey: string) {
    throw new Error('File bucket is readonly and cannot copy objects');
  }

  async deleteObject(_key: string) {
    throw new Error('File bucket is readonly and cannot delete objects');
  }

  async moveObject(_oldKey: string, _newKey: string): Promise<void> {
    throw new Error('File bucket is readonly and cannot move objects');
  }
}
