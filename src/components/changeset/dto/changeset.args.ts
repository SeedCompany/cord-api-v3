import { PipeTransform } from '@nestjs/common';
import { Args, ArgsType } from '@nestjs/graphql';
import { ID, IdField, ObjectView } from '../../../common';
import { ValidationPipe } from '../../../core/validation.pipe';

/**
 * A helper for id & changeset arguments.
 */
@ArgsType()
export class ChangesetIds {
  @IdField()
  id: ID;

  @IdField({ nullable: true })
  changeset: ID;
}

export type IdsAndView = ChangesetIds & { view: ObjectView };

export const IdsAndViewArg = () =>
  Args({ type: () => ChangesetIds }, ObjectViewPipe);

class ObjectViewPipe implements PipeTransform {
  async transform({ id, changeset }: ChangesetIds) {
    await new ValidationPipe().transform(
      { id, changeset },
      {
        metatype: ChangesetIds,
        type: 'body',
      }
    );
    const view: ObjectView = changeset ? { changeset } : { active: true };
    return { id, changeset, view };
  }
}
