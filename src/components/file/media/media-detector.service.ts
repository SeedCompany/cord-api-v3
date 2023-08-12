import ffprobeBinary from '@ffprobe-installer/ffprobe';
import { Injectable } from '@nestjs/common';
import execa from 'execa';
import { FFProbeResult } from 'ffprobe';
import { imageSize } from 'image-size';
import { Readable } from 'stream';
import { Except } from 'type-fest';
import { Downloadable } from '../dto';
import { AnyMedia, Media } from './media.dto';

@Injectable()
export class MediaDetector {
  async detect(
    file: Downloadable<{ mimeType: string }>,
  ): Promise<Except<AnyMedia, Exclude<keyof Media, '__typename'>> | null> {
    if (file.mimeType.startsWith('image/')) {
      const buffer = await file.download();

      const size = imageSize(buffer);

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
    const { stdout } = await execa(
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
        reject: false,
        input: stream,
      },
    );
    try {
      return JSON.parse(stdout);
    } catch {
      return {};
    }
  }
}
