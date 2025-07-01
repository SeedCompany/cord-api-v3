import { Injectable, type PipeTransform } from '@nestjs/common';
import { Args, ArgsType } from '@nestjs/graphql';
import { type ID, IdField, type ObjectView } from '~/common';
import { ValidationPipe } from '~/core/validation';

/**
 * A helper for id & changeset arguments.
 */
@ArgsType()
export class ChangesetIds {
  @IdField()
  id: ID;

  @IdField({ optional: true })
  changeset?: ID;
}

export type IdsAndView = ChangesetIds & { view: ObjectView };

export const IdsAndViewArg = () =>
  Args({ type: () => ChangesetIds }, ObjectViewPipe);

@Injectable()
export class ObjectViewPipe implements PipeTransform {
  constructor(private readonly validator: ValidationPipe) {}

  async transform(input: ChangesetIds) {
    const { id, changeset } = (await this.validator.transform(input, {
      metatype: ChangesetIds,
      type: 'body',
    })) as ChangesetIds;
    const view: ObjectView = changeset ? { changeset } : { active: true };
    return { id, changeset, view };
  }
}
