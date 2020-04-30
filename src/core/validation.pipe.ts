import {
  ValidationPipe as BaseValidationPipe,
  Injectable,
  ValidationError,
} from '@nestjs/common';
import { isEmpty } from 'lodash';
import { ClientException } from '../common/exceptions';

@Injectable()
export class ValidationPipe extends BaseValidationPipe {
  constructor() {
    super({
      transform: true,
      skipMissingProperties: true,
      exceptionFactory: (es) => new ValidationException(es),
    });
  }
}

export class ValidationException extends ClientException {
  readonly errors: Record<string, Record<string, string>>;
  readonly errorList: ValidationError[];

  constructor(errors: ValidationError[]) {
    super('Input validation failed');
    this.errors = flattenValidationErrors(errors);
    Object.defineProperty(this, 'errorList', { value: errors });
  }
}

const flattenValidationErrors = (
  e: ValidationError[],
  out: Record<string, any> = {},
  prefixes: string[] = []
) =>
  e.reduce((obj, error) => {
    const { target: _, value: __, property, children, constraints } = error;
    const path = [...prefixes, property];
    if (!isEmpty(constraints)) {
      obj[path.join('.')] = constraints;
    }
    if (!isEmpty(children)) {
      flattenValidationErrors(children, obj, path);
    }
    return obj;
  }, out);
