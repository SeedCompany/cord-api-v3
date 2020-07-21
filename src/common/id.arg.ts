import { ArgumentMetadata, PipeTransform, Type } from '@nestjs/common';
import { Args, ArgsOptions, ID } from '@nestjs/graphql';
import { ValidationPipe } from '../core/validation.pipe';
import { IsShortId } from './validators';

// just an object with the validator metadata
class IdHolder {
  @IsShortId()
  id: string;
}

class ValidateIdPipe implements PipeTransform {
  async transform(id: any, _metadata: ArgumentMetadata) {
    await new ValidationPipe().transform(
      { id },
      {
        metatype: IdHolder,
        type: 'body',
        data: 'id',
      }
    );
    return id;
  }
}

export const IdArg = (
  opts: Partial<ArgsOptions> = {},
  ...pipes: Array<Type<PipeTransform> | PipeTransform>
) => Args({ name: 'id', type: () => ID, ...opts }, ValidateIdPipe, ...pipes);
