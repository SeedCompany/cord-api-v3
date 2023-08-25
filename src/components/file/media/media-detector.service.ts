import ffprobeBinary from '@ffprobe-installer/ffprobe';
import { Injectable } from '@nestjs/common';
import { execa } from 'execa';
import { FFProbeResult } from 'ffprobe';
import { imageSize } from 'image-size';
import { ISize as ImageSize } from 'image-size/dist/types/interface';
import { EPIPE } from 'node:constants';
import { Readable } from 'stream';
import { Except } from 'type-fest';
import { retry } from '~/common/retry';
import { ILogger, Logger } from '~/core';
import { Downloadable } from '../dto';
import { AnyMedia, Media } from './media.dto';

@Injectable()
export class MediaDetector {
  constructor(@Logger('media:detector') private readonly logger: ILogger) {}

  async detect(
    file: Downloadable<{ mimeType: string }>,
  ): Promise<Except<AnyMedia, Exclude<keyof Media, '__typename'>> | null> {
    if (file.mimeType.startsWith('image/')) {
      const buffer = await file.download();

      let size: ImageSize = { width: 0, height: 0 };
      try {
        size = imageSize(buffer);
      } catch (e) {
        // ignore
      }

      return {
        __typename: 'Image',
        dimensions: {
          width: size.width ?? 0,
          height: size.height ?? 0,
        },
      };
    }

    const isAudio = file.mimeType.startsWith('audio/');
    const isVideo = file.mimeType.startsWith('video/');
    if (!isAudio && !isVideo) {
      return null;
    }

    const stream = await file.stream();

    const result = await this.ffprobe(stream);
    const { width, height, duration: rawDuration } = result.streams?.[0] ?? {};

    const d = rawDuration as string | number | undefined; // I've seen as string
    const duration = !d ? 0 : typeof d === 'string' ? parseFloat(d) : d;

    if (isAudio) {
      return { __typename: 'Audio', duration };
    }
    return {
      __typename: 'Video',
      dimensions: {
        width: width ?? 0,
        height: height ?? 0,
      },
      duration,
    };
  }

  private async ffprobe(stream: Readable): Promise<Partial<FFProbeResult>> {
    try {
      return await retry(
        async () => {
          const probe = await execa(
            ffprobeBinary.path,
            [
              '-v',
              'quiet',
              '-print_format',
              'json',
              '-show_format',
              '-show_streams',
              '-i',
              'pipe:0',
            ],
            {
              reject: false, // just return error instead of throwing
              input: stream,
              timeout: 10_000,
            },
          );
          // Ffprobe stops reading stdin & exits as soon as it has enough info.
          // This causes the input stream to SIGPIPE error.
          // In shells, this is normal and does not result in an error.
          // However, NodeJS converts/interrupts this as an EPIPE error.
          // https://github.com/sindresorhus/execa/issues/474#issuecomment-1640423498
          // I'm confused about positive vs negative exit codes, hence the abs.
          if (probe instanceof Error && Math.abs(probe.exitCode) === EPIPE) {
            throw probe;
          }
          return JSON.parse(probe.stdout);
        },
        {
          retries: 2,
          onFailedAttempt: (exception) => {
            const level = exception.retriesLeft > 0 ? 'warning' : 'error';
            this.logger[level]('ffprobe failed', { exception });
          },
        },
      );
    } catch (e) {
      return {};
    }
  }
}
