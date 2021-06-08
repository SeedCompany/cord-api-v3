import { InterfaceType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ID, IdField } from '../../../common';

@InterfaceType({
  description: stripIndent`
    An object that can be associated with change objects.
    The data returned in this object could be unique for the associated change
    returned.
  `,
})
export abstract class Changeable {
  @IdField({
    description: "The object's ID",
  })
  readonly id: ID;

  readonly changeset: ID;
}
