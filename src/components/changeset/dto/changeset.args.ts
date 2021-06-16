import { ArgsType } from '@nestjs/graphql';
import { ID, IdField } from '../../../common';

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
