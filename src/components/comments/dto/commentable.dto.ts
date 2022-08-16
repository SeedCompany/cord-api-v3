import { InterfaceType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ID, IdField } from '../../../common';

@InterfaceType({
  description: stripIndent`
    An object that can be used to enable Comment threads on a Node.
  `,
})
export abstract class Commentable {
  @IdField({
    description: "The object's ID",
  })
  readonly id: ID;
}
