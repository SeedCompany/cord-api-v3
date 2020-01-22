import { applyDecorators, ArgumentMetadata, PipeTransform, UnauthorizedException } from '@nestjs/common';
import { Context } from '@nestjs/graphql';

export function Token() {
  return applyDecorators(
    Context('token', new RequiredPipe()),
  ) as ParameterDecorator;
}

// TODO Replace with class-validator and ValidationPipe which hasn't been setup here
class RequiredPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata): any {
    if (!value) {
      throw new UnauthorizedException();
    }
    return value;
  }
}
