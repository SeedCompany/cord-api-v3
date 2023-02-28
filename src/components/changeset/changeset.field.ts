import { applyDecorators } from '@nestjs/common';
import { Field, FieldOptions, ID as IDType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ValidateEditability } from './validate-editability.decorator';

/**
 * A changeset input field
 */
export const ChangesetIdField = (options?: FieldOptions): PropertyDecorator =>
  applyDecorators(
    Field(() => IDType, {
      nullable: true,
      description: stripIndent`
        A changeset ID to reference as the version to load
        or associate these changes with.
      `,
      ...options,
    }),
    ValidateEditability(),
  );
