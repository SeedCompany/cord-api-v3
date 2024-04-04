import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { pickBy } from 'lodash';
import { Except } from 'type-fest';
import { ConfigService } from '~/core';

@Injectable()
export class CryptoService {
  constructor(private readonly config: ConfigService) {}

  async hash(plain: string) {
    return await argon2.hash(plain, this.argon2Options);
  }

  async verify(hash: string | null | undefined, plain: string) {
    return !!hash && (await argon2.verify(hash, plain, this.argon2Options));
  }

  private get argon2Options() {
    const options: Except<argon2.Options, 'raw'> = {
      secret: this.config.passwordSecret
        ? Buffer.from(this.config.passwordSecret, 'utf-8')
        : undefined,
    };
    // argon doesn't like undefined values even though the types allow them
    return pickBy(options, (v) => v !== undefined);
  }
}
