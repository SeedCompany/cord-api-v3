import npmFfprobe from '@ffprobe-installer/ffprobe';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CachedByArg as Once } from '@seedcompany/common';
import { $, execa } from 'execa';
import { type FFProbeResult } from 'ffprobe';
import { imageSize } from 'image-size';
import type { ISize as ImageSize } from 'image-size/types/interface';
import type { Except } from 'type-fest';
import { retry } from '~/common/retry';
import { ILogger, Logger } from '~/core';
import { type FileVersion } from '../dto';
import { FileService } from '../file.service';
import { type AnyMedia, type Media } from './media.dto';

@Injectable()
export class MediaDetector {
  constructor(
    @Inject(forwardRef(() => FileService))
    private readonly files: FileService & {},
    @Logger('media:detector') private readonly logger: ILogger,
  ) {}

  async detect(
    file: FileVersion,
  ): Promise<Except<AnyMedia, Exclude<keyof Media, '__typename'>> | null> {
    if (file.mimeType.startsWith('image/')) {
      const buffer = await this.files.asDownloadable(file).download();

      let size: ImageSize = { width: 0, height: 0 };
      try {
        size = imageSize(buffer);
      } catch (e) {
        // ignore
      }

      return {
        __typename: 'Image',
        dimensions: {
          // Guarding against library lies
          /* eslint-disable @typescript-eslint/no-unnecessary-condition */
          width: size.width ?? 0,
          height: size.height ?? 0,
          /* eslint-enable  @typescript-eslint/no-unnecessary-condition */
        },
      };
    }

    const isAudio = file.mimeType.startsWith('audio/');
    const isVideo = file.mimeType.startsWith('video/');
    if (!isAudio && !isVideo) {
      return null;
    }

    const url = await this.files.getDownloadUrl(file);

    const result = await this.ffprobe(url);
    const { width, height, duration: rawDuration } = result.streams?.[0] ?? {};

    const duration = rawDuration ? parseFloat(rawDuration) : 0;

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

  private async ffprobe(url: string): Promise<Partial<FFProbeResult>> {
    const binaryPath = await this.getFfprobeBinaryPath();
    try {
      return await retry(
        async () => {
          const probe = await execa(
            binaryPath,
            [
              '-v',
              'error',
              '-print_format',
              'json',
              '-show_format',
              '-show_streams',
              url,
            ],
            {
              timeout: 10_000,
            },
          );
          if (probe.stdout.trim() === '') {
            return {};
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

  @Once()
  private async getFfprobeBinaryPath() {
    try {
      await retry(async () => await $`which ffprobe`, { retries: 3 });
      return 'ffprobe';
    } catch {
      return npmFfprobe.path;
    }
  }
}
