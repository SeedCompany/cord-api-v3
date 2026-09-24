import npmFfprobe from '@ffprobe-installer/ffprobe';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CachedByArg as Once } from '@seedcompany/common';
import { $, execa, type ExecaError } from 'execa';
import { type FFProbeResult } from 'ffprobe';
import { imageSize } from 'image-size';
import type { ISize as ImageSize } from 'image-size/types/interface';
import type { Except } from 'type-fest';
import { retry } from '~/common';
import { ILogger, Logger } from '~/core/logger';
import { type FileVersion } from '../dto';
import { FileService } from '../file.service';
import { type AnyMedia, type Media } from './media.dto';

/**
 * ffprobe fetched the bytes and they are not decodable media — as opposed to a
 * transport failure (404, connection refused, timeout), which a second attempt
 * could resolve. This one returns the same answer every time.
 *
 * Matched narrowly on purpose: anything unrecognized still retries, so a
 * message we have not seen degrades to the old behavior rather than turning a
 * transient failure into a permanent one.
 */
const UNDECODABLE = /Invalid data found when processing input/i;

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

    const result = await this.ffprobe(url, file);
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

  private async ffprobe(
    url: string,
    file: FileVersion,
  ): Promise<Partial<FFProbeResult>> {
    const binaryPath = await this.getFfprobeBinaryPath();

    // `url` is a pre-signed S3 link — working access to a private object until
    // it expires. ffprobe echoes it back in its own stderr, and execa repeats
    // the whole command line in `message`, `shortMessage`, `command` and
    // `escapedCommand`, so no part of the error can be logged as it arrives.
    // Report the file instead, which is what you would want to look up anyway.
    const describe = (exception: Error) => {
      const { stderr, shortMessage } = exception as ExecaError;
      const text =
        (typeof stderr === 'string' && stderr) ||
        shortMessage ||
        exception.message;
      return text.split(url).join('<signed url>').trim();
    };
    const isUndecodable = (exception: Error) =>
      UNDECODABLE.test(describe(exception));

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
          // Decodability does not change between attempts, and every attempt
          // re-downloads the whole object from S3 to reach the same verdict.
          shouldRetry: (exception) => !isUndecodable(exception),
          onFailedAttempt: (exception) => {
            const context = { file: file.id, mimeType: file.mimeType };
            if (isUndecodable(exception)) {
              // Ordinary user content: someone uploaded a corrupt or mislabeled
              // file. The caller falls back to zeroed dimensions and duration,
              // and the upload still succeeds, so this is not a fault.
              this.logger.info('File is not decodable media', context);
              return;
            }
            const level = exception.retriesLeft > 0 ? 'warning' : 'error';
            this.logger[level]('ffprobe failed', {
              ...context,
              reason: describe(exception),
            });
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
