import { Injectable, PipeTransform } from '@nestjs/common';
import { Args, ArgsType } from '@nestjs/graphql';
import { ID, IdField, ObjectView } from '~/common';
import { ValidationPipe } from '~/core/validation';

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

@Injectable()
export class ObjectViewPipe implements PipeTransform {
  constructor(private readonly validator: ValidationPipe) {}

  async transform({ id, changeset }: ChangesetIds) {
    await this.validator.transform(
      { id, changeset },
      {
        metatype: ChangesetIds,
        type: 'body',
      },
    );
    const view: ObjectView = changeset ? { changeset } : { active: true };
    return { id, changeset, view };
  }
}
