import { Injectable } from '@nestjs/common';
import JWT from 'jsonwebtoken';
import { UnauthenticatedException } from '~/common';
import { ConfigService } from '~/core/config';
import { ILogger, Logger } from '~/core/logger';

interface JwtPayload {
  iat: number;
}

@Injectable()
export class JwtService {
  constructor(
    private readonly config: ConfigService,
    @Logger('jwt') private readonly logger: ILogger,
  ) {}

  encode() {
    const payload: JwtPayload = {
      iat: Date.now(),
    };

    return JWT.sign(payload, this.config.jwtKey);
  }

  decode(token?: string) {
    if (!token) {
      throw new UnauthenticatedException();
    }

    try {
      return JWT.verify(token, this.config.jwtKey) as JwtPayload;
    } catch (exception) {
      this.logger.warning('Failed to validate JWT', {
        exception,
      });
      throw new UnauthenticatedException(exception);
    }
  }
}
