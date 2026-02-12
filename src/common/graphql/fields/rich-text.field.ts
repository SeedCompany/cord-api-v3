import { applyDecorators } from '@nestjs/common';
import { type Nil } from '@seedcompany/common';
import { IsObject } from 'class-validator';
import { InputException } from '~/common/exceptions/input.exception';
import { RichTextDocument } from '~/common/features/rich-text';
import { RichTextScalar } from '~/common/scalars';
import { OptionalField, type OptionalFieldOptions } from './optional.field';

export const RichTextField = (options?: OptionalFieldOptions) =>
  applyDecorators(
    OptionalField(() => RichTextScalar, {
      optional: false,
      ...options,
      transform: (prev) => (value) => {
        const doc: RichTextDocument | Nil = prev(
          RichTextDocument.fromMaybe(value),
        );
        if (doc == null && !options?.nullable && !options?.optional) {
          // Should never _really_ get here.
          // UI should understand & send null instead of an empty document.
          // Would prefer this to be done with validators.
          // But I believe this needs `null`s to be validated.
          // skipMissingProperties -> skipUndefinedProperties
          throw new InputException('RichText must be given');
        }
        return doc;
      },
    }),
    IsObject(),
  );
