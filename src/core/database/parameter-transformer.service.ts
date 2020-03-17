import { Injectable } from '@nestjs/common';

/**
 * Transforms parameters going into the database
 */
@Injectable()
export class ParameterTransformer {
  transform(parameters: Record<string, any>): Record<string, any> {
    return parameters;
  }
}
