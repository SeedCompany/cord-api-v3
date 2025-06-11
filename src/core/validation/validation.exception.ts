import { type ValidationError } from '@nestjs/common';
import { entries } from '@seedcompany/common';
import type { SetRequired } from 'type-fest';
import { fileURLToPath } from 'url';
import { ClientException } from '~/common/exceptions';
import { jestSkipFileInExceptionSource } from '../exception';

export class ValidationException extends ClientException {
  readonly errors: Record<string, Record<string, string>>;
  readonly errorList: ValidationError[];

  constructor(errors: ValidationError[]) {
    super('Input validation failed');
    this.errors = flattenValidationErrors(errors);
    Object.defineProperty(this, 'errorList', {
      value: errors,
      enumerable: false,
    });
    const errorsAsString = flattenConstraints(errors)
      .map((e) => {
        const constraint = Object.values(e.constraints)[0];
        const target = e.target?.constructor.name ?? 'Object';
        const source = `${target}.${e.property}`;
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- I'm ok with string conversion here
        const value = `${e.value}`;
        return ` - ${constraint} for "${source}"\n   Given: \`${value}\``;
      })
      .join('\n');
    this.stack = this.stack!.replace('\n', '\n' + errorsAsString + '\n\n');

    jestSkipFileInExceptionSource(this, fileURLToPath(import.meta.url));
  }
}

/** Flatten validation errors keeping only errors with constraint violations */
const flattenConstraints = (
  e: ValidationError[],
): Array<SetRequired<ValidationError, 'constraints'>> =>
  e.flatMap((er) => [
    ...(er.constraints ? [er as SetRequired<ValidationError, 'constraints'>] : []),
    ...flattenConstraints(er.children ?? []),
  ]);

const flattenValidationErrors = (
  e: ValidationError[],
  out: Record<string, any> = {},
  prefixes: string[] = [],
) =>
  e.reduce((obj, error) => {
    const { target: _, value: __, property, children, constraints } = error;
    const path = [...prefixes, property];
    if (constraints && entries(constraints).length > 0) {
      obj[path.join('.')] = constraints;
    }
    if (children && entries(children).length > 0) {
      flattenValidationErrors(children ?? [], obj, path);
    }
    return obj;
  }, out);
