import { ArgumentsHost } from '@nestjs/common';
import { NotFoundException as NestjsNotFoundException } from '@nestjs/common/exceptions/not-found.exception';
import { IncomingMessage } from 'http';

export const isFromHackAttempt = (error: Error, args: ArgumentsHost) => {
  if (
    // Any route not found is a hack attempt
    error instanceof NestjsNotFoundException &&
    // Let devs make errors, so only check deployed
    process.env.NODE_ENV === 'production' &&
    args.getType() === 'http'
  ) {
    return args.switchToHttp().getRequest<IncomingMessage>();
  }
  return undefined;
};
