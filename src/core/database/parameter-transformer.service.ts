import { Injectable } from '@nestjs/common';
import { mapValues } from 'lodash';
import { DateTime, Duration } from 'luxon';
import * as Neo from 'neo4j-driver';
import { CalendarDate, RichTextDocument } from '../../common';
import { isNeoDate, isNeoDateTime, isNeoDuration } from './transformer';

/**
 * Transforms parameters going into the database
 */
@Injectable()
export class ParameterTransformer {
  transform(parameters: Record<string, any>): Record<string, any> {
    return this.transformValue(parameters);
  }

  transformValue(value: any): any {
    if (this.isPlainValue(value)) {
      return value;
    }

    // Ensure consistency across codebase
    if (value instanceof Date) {
      throw new Error('Use Luxon DateTime instead');
    }

    if (
      value instanceof Neo.types.Integer ||
      isNeoDateTime(value) ||
      isNeoDate(value) ||
      isNeoDuration(value)
    ) {
      return value;
    }

    if (value instanceof CalendarDate) {
      return value.toNeo4JDate();
    }

    if (value instanceof DateTime) {
      return value.toNeo4JDateTime();
    }

    if (value instanceof Duration) {
      value = value.shiftTo('months', 'days', 'seconds', 'milliseconds');
      return new Neo.Duration(
        value.months,
        value.days,
        value.seconds,
        value.milliseconds * 1e6
      );
    }

    if (value instanceof RichTextDocument) {
      return RichTextDocument.serialize(value);
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.transformValue(v));
    }

    if (typeof value === 'object') {
      return mapValues(value, (v) => this.transformValue(v));
    }

    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`Could not determine how to transform value: ${value}`);
  }

  private isPlainValue(value: any) {
    const type = typeof value;
    return (
      value == null ||
      type === 'string' ||
      type === 'boolean' ||
      type === 'number'
    );
  }
}
