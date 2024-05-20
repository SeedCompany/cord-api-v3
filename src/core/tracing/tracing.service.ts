import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import XR from 'aws-xray-sdk-core';
import { ServerException } from '~/common';

@Injectable()
export class TracingService implements OnModuleDestroy {
  readonly segmentStorage = new AsyncLocalStorage<XR.Segment | XR.Subsegment>();

  capture<R>(name: string, cb: (sub: Segment) => Promise<R>) {
    const seg =
      this.segmentStorage.getStore()?.addNewSubsegment(name) ??
      new XR.Subsegment(name);
    return this.segmentStorage.run(seg, async () => {
      try {
        const res = await cb(seg as any);
        if (!seg.isClosed()) {
          seg.close();
        }
        return res;
      } catch (e) {
        if (!seg.isClosed()) {
          seg.close(e);
        }
        throw e;
      }
    });
  }

  /**
   * The current segment in the current async context.
   */
  get segment() {
    const current = this.segmentStorage.getStore();
    if (!current) {
      throw new ServerException(
        'Cannot get segment outside of defined context',
      );
    }
    return current as unknown as Segment;
  }

  /**
   * The current root segment in the current async context.
   */
  get rootSegment() {
    const segment = this.segment;
    return (segment.segment ?? segment)!;
  }

  onModuleDestroy() {
    this.segmentStorage.disable();
  }
}

/* eslint-disable @typescript-eslint/method-signature-style */

/**
 * This is a re-type of xray's Subsegment simplified and documented for use across the app.
 *
 * More type info here
 * @see https://docs.aws.amazon.com/xray/latest/devguide/xray-api-segmentdocuments.html
 */
export interface Segment {
  name: string;

  /** start time in seconds but with millisecond precision */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  start_time: number;

  parent?: Segment;
  /** root */
  segment?: Segment;

  namespace?: 'remote' | 'aws';

  /** Define SQL info */
  sql?: Record<string, any>;

  /**
   * Add annotation to segment.
   * Annotations are aggregate-able, index-able tags and there for need to be
   * simple values.
   */
  addAnnotation(key: string, value: string | number | boolean): void;

  /**
   * Add metadata to segment.
   * Metadata is for per-trace data, for individual reflection.
   * It cannot be searched on but can be viewed individually.
   * Complex (json-able) data is allowed here.
   */
  addMetadata(key: string, value: unknown): void;

  /**
   * Faults are server problems
   */
  addFaultFlag(): void;

  /**
   * Errors are client problems
   */
  addErrorFlag(): void;

  addThrottleFlag(): void;

  setUser?: (userId: string) => void;

  addError(err: Error | string, remote?: boolean): void;

  isClosed(): boolean;

  /**
   * Close segment and optionally call addError with error if given.
   */
  close(err?: Error | string | null, remote?: boolean): void;

  removeSubsegment(subsegment: Segment): void;
}
