import { ValidationArguments } from 'class-validator';
import { Merge } from 'type-fest';
import { createValidationDecorator } from '~/common/validators/validateBy';
import { ScriptureRange } from './scripture-range.dto';

// We assume this is only used on the ScriptureRange object
type ValidationArgs = Merge<ValidationArguments, { object: ScriptureRange }>;

export const IsValidOrder = createValidationDecorator({
  name: 'ScriptureRange',
  validator: {
    validate: (_, { object }: ValidationArgs) => {
      try {
        const range = ScriptureRange.fromReferences(object);
        return range.start <= range.end;
      } catch {
        return true; // ignore this validator if others will fail
      }
    },
    defaultMessage: () => {
      return 'Scripture range must end after the starting point';
    },
  },
});
