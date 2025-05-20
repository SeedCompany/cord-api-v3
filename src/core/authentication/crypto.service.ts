import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
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
    return {
      ...(this.config.passwordSecret && {
        secret: Buffer.from(this.config.passwordSecret, 'utf-8'),
      }),
    } satisfies argon2.Options;
  }
}
