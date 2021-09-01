import { PipeTransform } from '@nestjs/common';
import { Args, ArgsType } from '@nestjs/graphql';
import { ID, IdField, ObjectView } from '../../../common';

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

class ObjectViewPipe implements PipeTransform<ChangesetIds, IdsAndView> {
  transform(value: ChangesetIds) {
    const view: ObjectView = value.changeset
      ? { changeset: value.changeset }
      : { active: true };
    return { ...value, view };
  }
}
