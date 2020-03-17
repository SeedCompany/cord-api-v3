import { Injectable } from '@nestjs/common';
import { mapValues } from 'lodash';
import { DateTime } from 'luxon';
import { isNeoDate, isNeoDateTime } from './transformer';

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

    if (isNeoDateTime(value) || isNeoDate(value)) {
      return value;
    }

    if (value instanceof DateTime) {
      return value.toNeo4JDateTime();
    }

    // TODO Luxon to Neo4J Date

    if (Array.isArray(value)) {
      return value.map(v => this.transformValue(v));
    }

    if (typeof value === 'object') {
      return mapValues(value, v => this.transformValue(v));
    }

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
