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
    const errorsAsString = errors
      .map((e) => {
        const constraint = Object.values(e.constraints)[0];
        const source = `${e.target.constructor.name}.${e.property}`;
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- I'm ok with string conversion here
        const value = `${e.value}`;
        return ` - ${constraint} for "${source}"\n   Given: \`${value}\``;
      })
      .join('\n');
    this.stack = this.stack!.replace('\n', '\n' + errorsAsString + '\n\n');
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
